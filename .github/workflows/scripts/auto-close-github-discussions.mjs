const GITHUB_API = 'https://api.github.com';

// Bound so a hung GitHub call fails the scheduled run promptly instead of
// occupying a runner until the job-level timeout.
const REQUEST_TIMEOUT_MS = 30_000;

// Get current repository details from the GITHUB_REPOSITORY environment variable ("owner/repo")
const repoInfo = process.env.GITHUB_REPOSITORY;
if (!repoInfo) {
  console.error('GITHUB_REPOSITORY environment variable not set');
  process.exit(1);
}
const [OWNER, REPO] = repoInfo.split('/');

// ONE_WEEK_MS is set to one week (in milliseconds)
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

async function run() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('GITHUB_TOKEN not set');
    process.exit(1);
  }

  const closingMessage = process.env.CLOSING_MESSAGE || 'Closing discussion due to inactivity.';

  const headers = {
    accept: 'application/vnd.github+json',
    authorization: `token ${token}`,
    'user-agent': 'auto-close-discussions',
  };

  const rest = async (path) => {
    const response = await fetch(`${GITHUB_API}${path}`, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`GitHub REST ${path} responded ${response.status}: ${await response.text()}`);
    }
    return response.json();
  };

  const graphqlWithAuth = async (query, variables) => {
    const response = await fetch(`${GITHUB_API}/graphql`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const payload = await response.json();
    if (payload.errors) {
      const error = new Error(payload.errors.map((entry) => entry.message).join('; '));
      error.errors = payload.errors;
      throw error;
    }
    return payload.data;
  };

  try {
    // 1. Get the repository ID first (needed for GraphQL)
    const repoData = await rest(`/repos/${OWNER}/${REPO}`);
    const repoId = repoData.node_id;

    const collabResponse = await rest(`/repos/${OWNER}/${REPO}/collaborators`);

    const collaborators = collabResponse
      .filter((user) => user.permissions && user.permissions.push)
      .map((user) => user.login);
    console.log(`Found ${collaborators.length} collaborators with write access.`);

    const categoriesQuery = await graphqlWithAuth(
      `query getCategories($repoId: ID!) {
        node(id: $repoId) {
          ... on Repository {
            discussionCategories(first: 25) {
              nodes {
                id
                name
              }
            }
          }
        }
      }`,
      { repoId },
    );
    const categories = categoriesQuery.node.discussionCategories.nodes;
    const qaCategory = categories.find((cat) => cat.name === 'Q&A');
    if (!qaCategory) {
      console.error('No Q&A category found.');
      process.exit(1);
    }
    console.log(`Found Q&A category with ID: ${qaCategory.id}`);

    // 2. Fetch top 50 open discussions in the Q&A category
    const discussionsQuery = await graphqlWithAuth(
      `query getDiscussions($repoId: ID!, $categoryId: ID!) {
        node(id: $repoId) {
          ... on Repository {
            discussions(first: 50, states: OPEN, categoryId: $categoryId) {
              nodes {
                id
                number
                title
                body
                createdAt
                updatedAt
                labels(first: 10) {
                  nodes {
                    id
                    name
                  }
                }
                comments(first: 50) {
                  nodes {
                    id
                    createdAt
                    author {
                      login
                    }
                    replies(first: 50) {
                      nodes {
                        id
                        createdAt
                        author {
                          login
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }`,
      { repoId, categoryId: qaCategory.id },
    );

    // Extract discussions
    const discussions = discussionsQuery.node.discussions.nodes;
    console.log(`Fetched ${discussions.length} discussions`);

    // 3. Filter open discussions that have at least one of the target labels
    const targetLabels = ['discussion/needs-information', 'discussion/needs-confirmation'];
    const filteredDiscussions = discussions.filter((discussion) => {
      if (!discussion.labels.nodes || discussion.labels.nodes.length === 0) return false;
      const labels = discussion.labels.nodes.map((label) => label.name);
      return targetLabels.some((target) => labels.includes(target));
    });

    console.log(
      `Found ${filteredDiscussions.length} open Q&A discussions with at least one target label.`,
    );

    // 4. Process each filtered discussion
    for (const discussion of filteredDiscussions) {
      const discussionNumber = discussion.number;
      console.log(`Processing discussion #${discussionNumber}: ${discussion.title}`);

      // Find the most recent activity (comment or reply)
      let lastActivity = null;
      let lastActivityDate = null;
      let lastActivityAuthor = null;

      // Check if there are comments
      if (!discussion.comments.nodes.length) {
        console.log('No comments found, skipping.');
        continue;
      }

      // Find the most recent activity date from all comments and replies
      for (const comment of discussion.comments.nodes) {
        const commentDate = new Date(comment.createdAt);
        if (!lastActivityDate || commentDate > lastActivityDate) {
          lastActivity = 'comment';
          lastActivityDate = commentDate;
          lastActivityAuthor = comment.author.login;
        }
        if (comment.replies && comment.replies.nodes) {
          for (const reply of comment.replies.nodes) {
            const replyDate = new Date(reply.createdAt);
            if (!lastActivityDate || replyDate > lastActivityDate) {
              lastActivity = 'reply';
              lastActivityDate = replyDate;
              lastActivityAuthor = reply.author.login;
            }
          }
        }
      }

      console.log(
        `Last activity on discussion #${discussionNumber} was a ${lastActivity} from ${lastActivityAuthor} on ${lastActivityDate}`,
      );

      // Check if the last activity is by a collaborator with write access and older than one week
      const now = new Date();

      if (
        collaborators.includes(lastActivityAuthor) &&
        now.getTime() - lastActivityDate.getTime() > ONE_WEEK_MS
      ) {
        console.log(
          `Discussion #${discussionNumber} qualifies for closure. Last activity was from collaborator ${lastActivityAuthor} more than a week ago.`,
        );

        // 5. Add a closing comment using GraphQL
        try {
          await graphqlWithAuth(
            `mutation AddDiscussionComment($discussionId: ID!, $body: String!) {
                addDiscussionComment(input: {discussionId: $discussionId, body: $body}) {
                  comment {
                    id
                  }
                }
            }`,
            {
              discussionId: discussion.id,
              body: closingMessage,
            },
          );
          console.log(`Posted closing comment on discussion #${discussionNumber}.`);
        } catch (commentError) {
          console.error(`Error posting comment: ${commentError.message}`);
          if (commentError.response) console.error(JSON.stringify(commentError.response, null, 2));
          continue;
        }

        // 6. Remove target labels using GraphQL removeLabelsFromLabelable mutation
        try {
          const labelsToRemove = discussion.labels.nodes
            .filter((label) => targetLabels.includes(label.name))
            .map((label) => label.id);

          if (labelsToRemove.length > 0) {
            await graphqlWithAuth(
              `mutation RemoveLabels($labelableId: ID!, $labelIds: [ID!]!) {
                  removeLabelsFromLabelable(input: {
                    labelableId: $labelableId,
                    labelIds: $labelIds
                  }) {
                    clientMutationId
                  }
              }`,
              {
                labelableId: discussion.id,
                labelIds: labelsToRemove,
              },
            );
            console.log(`Removed target labels from discussion #${discussionNumber}.`);
          } else {
            console.log(`No target labels to remove from discussion #${discussionNumber}.`);
          }
        } catch (labelError) {
          console.error(`Error removing labels: ${labelError.message}`);
          if (labelError.errors) console.error(JSON.stringify(labelError.errors, null, 2));
        }

        // 7. Close the discussion using GraphQL with the OUTDATED reason
        try {
          await graphqlWithAuth(
            `mutation CloseDiscussion($discussionId: ID!) {
              closeDiscussion(input: {discussionId: $discussionId, reason: OUTDATED}) {
                discussion {
                  id
                }
              }
            }`,
            {
              discussionId: discussion.id,
            },
          );
          console.log(`Closed discussion #${discussionNumber} as OUTDATED.`);
        } catch (closeError) {
          console.error(`Error closing discussion: ${closeError.message}`);
          if (closeError.response) console.error(JSON.stringify(closeError.response, null, 2));
        }
      } else {
        console.log(`Discussion #${discussionNumber} does not qualify for closure.`);
      }
    }
  } catch (error) {
    console.error('Error processing discussions:', error);
    if (error.response) console.error(JSON.stringify(error.response, null, 2));
  }
}

run();

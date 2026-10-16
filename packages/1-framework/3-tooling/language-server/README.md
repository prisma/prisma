# Prisma 8 language server

The Prisma 8 language server provides diagnostics, formatting, code completion, attribute signature help, hover, go-to-definition, find references, and rename for PSL schemas through the Language Server Protocol.

## Project membership and diagnostics

A project's schema is every file matching the config's `contract.source.inputs` glob(s) whose current text carries `// use prisma-8` — the same gate `contract emit` applies, so the two surfaces agree on what the schema is. Membership is re-expanded on load, config reload, and schema-file watcher events, not fixed at config-read time: a file created after the server started joins on the next membership refresh without a config edit.

Unopened members are read from disk and interpreted alongside open ones: symbols and diagnostics span the whole membership set. Disk snapshots are cached until invalidation, without read-time metadata checks. Open editor text remains authoritative even when disk notifications invalidate cached content.

### Filesystem updates

Each project permanently observes its config directory with a shallow internal subscription, including while loading. Schema notifications use one of two backends:

- **Client notifications:** when dynamic registration succeeds and every input pattern is compatible with LSP watching. The supported subset is simple ASCII paths with ordinary `*`, `?`, or whole-segment `**` wildcards. A successful compatible registration does not create a duplicate internal schema watcher.
- **Internal Chokidar 5 watching:** when the client lacks support, registration fails, or patterns use extended or uncertain syntax such as extglobs, braces, brackets, negation, escapes, or file URIs. Successful superseded registrations are disposed. An unanswered registration can leave schema notifications unavailable indefinitely without blocking loading, editor features, or disposal.

Internal watching covers literal directory roots derived from positive input patterns, including safe existing ancestors of missing directories. This detects future members under initially empty globs. The permanent config subscription observes atomic config replacement without editor activity. Events trigger the same input expansion and directive check as loading, rather than a separate watcher-specific membership matcher.

Internal watching derives directories through the shared config helper using Minimatch's parsed pattern sets, then uses path APIs to resolve them and find existing ancestors. It refuses recursive filesystem-root/share coverage. Static parent segments are resolved normally: `schemas/../outside/**/*.prisma` watches `outside`, and external absolute inputs remain supported. Brace alternatives and dynamic parent traversal broaden the root as needed: `schemas/{../outside,inside}/*.prisma` watches the parent of `schemas`, covering both branches. Directory wildcards such as `?` and `user?` watch their containing directory, including future matching directories. Pattern expansion remains separate and uses Node built-ins. Chokidar does not follow symlinks; coverage of changes to symlink targets is best-effort, without exhaustive path validation or per-link warnings. Watching does not discover new projects across the workspace or follow imported config dependencies.

Loading and editor operations do not wait for registration or internal readiness. On readiness, the project discards potentially stale disk snapshots and reconciles membership to include changes during startup. Watcher failures are logged and do not suspend analysis or discard overlays. Ordinary reloads retain subscriptions when inputs are unchanged; failed reloads leave subscriptions unchanged. Successful changed-input loads update schema roots. Root changes close the old schema subscription before starting its replacement, allowing a gap in schema observations while config observation continues. Reload explicitly evicts disk snapshots, but unchanged-input reloads do not retry watcher setup; a server restart can be needed after watcher failure. There is no stat-on-read fallback or application-owned polling loop. Chokidar uses native watching by default; library-internal polling, including environment overrides, is permitted. `awaitWriteFinish` is disabled. A client that silently drops notifications is not detected.

### Diagnostic delivery

Diagnostic delivery has exactly two modes, selected during initialization:

| Client capabilities | Schema diagnostic delivery |
| --- | --- |
| `textDocument.diagnostic.relatedDocumentSupport: true` | Advertise `diagnosticProvider`; each pull returns the requested file's full report plus full `relatedDocuments` reports for every other project member, open or closed. No schema-member diagnostics are pushed. |
| All other clients, including pull clients without related-document support | Do not advertise `diagnosticProvider`; push `textDocument/publishDiagnostics` for every affected project member, open or closed. |

Both modes use the same diagnostic assembler. Empty reports clear previous findings, including those for members removed by deletion, directive removal, or config changes. Pull delivery tracks previously reported members per project so the next project pull can include empty related reports for removed members. Pulling an excluded former member first does not discard its pending related clear.

In pull mode, `interFileDependencies: true` tells the client that editor edits can change diagnostics in other files. Config and external-file notifications invalidate project state and request `workspace/diagnostic/refresh` when the client supports it. Without refresh support, updates are observed on the next client pull; the server does not fall back to pushing schema diagnostics. Config-load failures remain a separate `publishDiagnostics` notification on the config file in either mode. Protocol tests exercise capability negotiation and reports using in-process clients; they do not establish adoption by real editors.

Equivalent file URIs share one document and one normalized URI for source filenames and diagnostic publications, including clears. Normalization follows file-path identity: percent encoding is standardized, Windows paths are case-folded, and UNC authorities are preserved. The server does not resolve symlinks or preserve the editor's original URI spelling.

Each immutable document snapshot parses lazily, at most once, and owns its AST, source registry, and raw parser diagnostics. Reading text alone does not parse. Configuration reloads evict project disk snapshots while retaining editor overlays, and rebuild combined sources, symbols, binding, and interpretation. `ProjectArtifacts.document(uri)` returns the snapshot itself without parsing. `ProjectArtifacts.diagnostics(uri)` combines mapped parse and symbol diagnostics with one semantic diagnostic source; whole-project reports supply precomputed symbol diagnostics so each report scans the project once for symbols. Interpretation is memoized per project revision, not attached to a document snapshot. Edits and disk invalidation produce new snapshots without changing previous parses.

Semantic diagnostics come from the configured interpreter when available, or from binding when no interpreter is configured. Interpreter failures do not switch diagnostic sources.

## Internal ownership

Closing the last editor document does not remove its project. Each config path has one stable `Project` instance, while document associations can be removed and discovered again. For example, reopening a file under the same config reuses its existing project even though closing it removed the document-to-project association.

| Component | Responsibility |
| --- | --- |
| [`server.ts`](src/server.ts) | Capability negotiation, protocol registration, editor-buffer updates, and feature-handler delegation. |
| [`ProjectRegistry`](src/project-registry.ts) | Config-to-project and document-to-project indexes, nearest-config discovery, association cleanup, config watching, watched-file dispatch, and the global event sequence. |
| [`Project`](src/project.ts) | Private resolved configuration and load state, serialized reloads and last-good fallback, membership transitions, client/internal watcher lifecycle and event batches, diagnostic history, and operations using the resolved analysis. |
| [`ProjectArtifacts`](src/project-artifacts.ts) | Participating snapshots, combined sources and symbols, the snapshot's binder, interpretation, and diagnostic assembly. |
| [`DocumentStore`](src/document-store.ts) and [`DocumentSnapshot`](src/document-snapshot.ts) | Authoritative editor overlays and explicitly invalidated disk caches; immutable text snapshots with lazy parsing. |

Nearest-config discovery does not establish schema membership. Project operations check membership against their resolved configuration; pull reports can also serve a previously reported URI that has left membership so the client receives its clearing report. Synchronous AST and symbol reads use the existing document association without starting discovery or loading.

The registry supplies the event sequence used by project membership transitions. Projects invalidate disk text before expanding membership; reloads advance the same sequence. Each project checks its accepted sequence and resolved configuration identity across membership expansion, while a registration-attempt identity rejects and disposes superseded client registrations. Failed reloads retain the last-good configuration; failed first loads remove open-document associations so later requests can retry. In-flight reads retain the resolution they awaited rather than switching to a later queued load.

Both backends use a 100 ms trailing debounce to coalesce notification bursts for analysis. Each notification resets the delay while no batch is running. This is not a write-completion guarantee and does not depend on Chokidar's private suppression timing. Each batch clears disk-backed entries from the shared document store while preserving editor overlays, and clears only the affected project's analysis artifacts. This also refreshes candidates that have not opted in through the directive, without retaining a history of read URIs. Other projects may reread disk files afterward. It then reloads configuration or resolves membership and publishes clears or requests pull refresh. This costs more disk I/O than path-specific invalidation but needs only refresh-needed and config-reload-needed flags. Events arriving during asynchronous work schedule a later pass. Membership sequences and configuration identity reject stale analysis. Permanent config observation survives consecutive asynchronous reloads, without retained watcher generations or replacement-readiness coordination. Server shutdown and asynchronous disposal cancel queued work and await serialized internal updates and Chokidar closures, never an unanswered client registration.

## Completion

Attribute, argument, function, identifier-value, registered scalar, generic block, and block parameter completions use contribution documentation as their detail when available. Scalar constructors, generic block descriptors, and block parameter descriptors can supply this text through their optional `documentation` property. Undocumented descriptors retain their generic completion details.

Required argument snippets use argument names as editable placeholders. Generic block snippets insert required parameters with named placeholders, omitting optional parameters and attributes. Blocks without required parameters include a comment hint describing their contents. Field-reference completions suggest scalar fields only, excluding relation and composite fields.

## Signature help

In an open, configured PSL input marked with `// use prisma-8`, clients can request signature help explicitly or trigger it when typing `(` or `,`. Help shows type-only positional parameters, named-only parameter names, optional markers, and declaration-authored Markdown documentation. Positional parameter documentation identifies the declaration name; parameters accepting both forms appear once and document their named alias. Named arguments highlight their matching parameter regardless of source order.

Field, model, and generic-block attributes use the project's contribution specs, so extension-authored signatures participate without additional server registration. Known nested functions show their innermost signature; unknown nested calls suppress help rather than display a misleading outer signature. Unfinished argument lists are supported from the current editor buffer even when contract interpretation fails.

Snippet-capable clients can opt into argument hints after completion by setting `initializationOptions.completion.supportsTriggerParameterHintsCommand: true` when they implement `editor.action.triggerParameterHints`. Only completions inserting argument snippets carry that command; plain names, existing argument lists, and nullary functions do not. Optional-only function snippets place a tab stop inside the parentheses. The playground also retriggers hints when Tab or Shift+Tab moves within an active PSL snippet.

The client controls tooltip presentation and the shortcut for an explicit signature-help request. Closed or unmanaged documents receive no help, and failures while resolving signature metadata produce an empty response without terminating the server.

## Hover

In an open, configured PSL input, clients can request hover over a model, composite type, field, named type, or generic block, at either its declaration or a reference to it. The tooltip shows the declaration line — `model User`, a field's full declaration, a named type's binding, or a block's keyword and name — followed by its `///` documentation comment, when one is present. Hovering a namespace, at the name of a `namespace` block or at a qualifier such as `auth` in `auth.User`, shows `namespace auth`.

Hovering a model, field, or block attribute shows the same signature label signature help renders for it, followed by the attribute's documentation; field attributes take the `@` prefix, model and block attributes take `@@`. Hovering a contributed type (a scalar constructor such as a database-specific type) shows its dotted path with its argument types, followed by the contributing extension's documentation for it. Hovering a generic block's keyword (`policy`, `view`, and similar) shows the extension's documentation for that kind of block, with no declaration line.

Hovering a named argument's key — in an attribute call, a function call, or a struct-block entry — shows that key with its type, e.g. `fields: field name`, followed by the parameter's documentation. Hovering a function call's name, such as `autoincrement()` or `uuid((4 | 7)?)`, shows its signature label followed by the function's documentation. Hovering a fixed-identifier constant, such as `Cascade` in a referential-action argument, shows the constant's name followed by its documentation.

A declaration, attribute, contributed type, parameter, function, or constant with no documentation to show omits that section rather than leaving a blank one; a block keyword with no contributed documentation shows no hover at all. Closed or unmanaged documents, and positions with nothing to show, also receive no hover.

## Go to definition

In an open, configured PSL input, clients can jump from a name to the declaration it refers to. A type reference leads to the model, composite type, named type, or generic block it names. A field or entity reference in an attribute argument or a generic block's value leads to that field or declaration. The qualifier of a qualified name, such as `auth` in `auth.User`, leads to every `namespace auth { … }` block, including those in other files of the project.

A declaration's own name leads to that declaration: `User` in `model User` leads to the model itself, and the name of a `namespace` block leads to every block of that namespace. Editors that run find references when a definition is the position the cursor is already on, such as VS Code, show the usages from there.

A name with no declaration in the schema has no definition: a contributed type or namespace, a cross-space reference, an attribute name, a named argument's key, a function name, or a fixed-identifier constant. A name that does not resolve has none either.

## Find references

In an open, configured PSL input, clients can request the usages of a model, composite type, named type, generic block (including an enum), field, or namespace. The cursor can be on the declaration name or on any reference; both return the same list. Usages come from every schema file of the project, including files that are not open.

A usage is a name that resolves to the same declaration, so the result agrees with go-to-definition: two fields named `id` on different models have separate usage lists, and a longer name, a comment or a string that contains the name is not a usage. Each result is the range of one identifier: `User` alone in `auth.User` for the model, `auth` alone for the namespace.

The declaration's name is returned only when the client asks to include the declaration. A namespace is the exception: the name of every `namespace` block is always returned, because each block both declares the namespace and uses it.

Enum members, attributes, argument keys, functions, contributed types and namespaces, cross-space references and unresolved names have no usages to list and return an empty result. Closed or unmanaged documents also return an empty result.

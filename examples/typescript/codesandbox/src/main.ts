import Photon from "@generated/photon";

const main = async () => {
  const photon = new Photon();

  await photon.connect();

  // Create a new post (written by an already existing user with email alice@prisma.io)
  await photon.users.create({
    data: {
      name: "Alice",
      email: "alice@prisma.io"
    }
  });
  await photon.users.findMany({});

  await photon.disconnect();
};

main().catch(console.error);

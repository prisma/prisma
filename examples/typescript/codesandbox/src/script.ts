import Photon from "@generated/photon";

const main = async () => {
  const photon = new Photon();

  await photon.connect();

  // Get a list of all esisting users (Created already using a seed script)
  const users = await photon.users.findMany({});
  console.log(users);

  await photon.disconnect();
};

main().catch(console.error);

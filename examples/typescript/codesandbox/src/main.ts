import Photon from "@generated/photon";

const main = async () => {
  const photon = new Photon();

  await photon.connect();

  await photon.users.findMany({});

  await photon.disconnect();
};

main().catch(console.error);

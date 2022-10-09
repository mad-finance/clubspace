import { VERIFIER_ADDRESS } from "@/lib/consts";
import { Contract, providers, utils, Wallet } from "ethers";
import { NextApiRequest, NextApiResponse } from "next";
import contractAbi from "../../../lib/semaphore/abi.json";

const provider = new providers.JsonRpcProvider(process.env.NEXT_PUBLIC_MUMBAI_URL);
const signer = new Wallet(process.env.ADMIN_KEY, provider);
const contract = new Contract(VERIFIER_ADDRESS, contractAbi, signer);

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { groupId, recipient, merkleRoot, nullifierHash, solidityProof } = req.body;

  try {
    const transaction = await contract.claim(
      groupId,
      recipient,
      utils.formatBytes32String("club space"),
      merkleRoot,
      nullifierHash,
      solidityProof
    );
    console.log(transaction.hash);
    await transaction.wait();

    res.status(200).end();
  } catch (error: any) {
    console.error(error);

    res.status(500).end();
  }
};

export default handler;

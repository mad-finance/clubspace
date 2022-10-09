// import { useSubscription, useClient } from "streamr-client-react";
import { STREAMR_PUBLIC_ID } from "@/lib/consts";
import redisClient from "@/lib/utils/redisClient";
import { Profile, useGetProfilesByHandles, useGetProfilesOwned } from "@/services/lens/getProfile";
import { groupBy, sortBy } from "lodash/collection";
import { mapValues } from "lodash/object";
import { isEmpty } from "lodash/lang";
import { last } from "lodash/array";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import StreamrClient from "streamr-client";
import { useAccount, useProvider } from "wagmi";

const LiveSpace = ({ clubSpaceObject }) => {
  const {
    query: { handle },
    push,
  } = useRouter();
  const { isConnected, address } = useAccount();
  const [hasMounted, setHasMounted] = useState(false);
  const [latestMessage, setLatestMessage] = useState();
  const [defaultProfile, setDefaultProfile] = useState<Profile>();
  const [liveProfiles, setLiveProfiles] = useState<string[]>();
  const { data: profiles } = useGetProfilesOwned({}, address);
  const [isLoadingEntry, setIsLoadingEntry] = useState(true);
  const [logs, setLogs] = useState([]);
  const { data: liveProfilesData } = useGetProfilesByHandles({}, liveProfiles); // TODO: not efficient but oh well

  console.log(liveProfilesData);

  if (typeof window !== "undefined" && !window.client) {
    const { address, privateKey } = StreamrClient.generateEthereumAccount();
    window.client = new StreamrClient({ auth: { privateKey } });
  }

  useEffect(() => {
    if (profiles?.length) {
      setDefaultProfile(profiles[0]);
    }
  }, [address, profiles]);

  const logPrivy = async (impressionPayload) => {
    await fetch(`/api/privy/write`, { method: "POST", body: JSON.stringify(impressionPayload) });
  };

  const handleEntry = async () => {
    // HACK: until their client accepts provider from rainbowkit :shrug:
    // const client = new StreamrClient(provider);

    const subscription = await window.client.subscribe(STREAMR_PUBLIC_ID, onMessage);

    const historical = await window.client.resend(
      STREAMR_PUBLIC_ID,
      { from: { timestamp: clubSpaceObject.createdAt } },
      (content, metadata) => {
        // :shrug:
        if (
          content.clubSpaceId === clubSpaceObject.clubSpaceId &&
          (content.type === "JOIN" || content.type === "LEAVE")
        ) {
          logs.push({ ...content, timestamp: metadata.messageId.timestamp });
          setLogs(logs);
        }
      }
    );

    console.log(`fetching historical from timestamp: ${clubSpaceObject.createdAt}`);

    historical.onFinally(() => {
      console.log("done fetching historical");
      const grouped = mapValues(groupBy(logs, "lensHandle"), (_logs) => sortBy(_logs, _logs.timestamp));
      // JOIN, LEAVE, JOIN
      // console.log(grouped);
      const stillHereYo = Object.keys(grouped).map((handle) => {
        if (last(grouped[handle]).type !== "LEAVE") return handle;
      }).filter((h) => h);

      setLiveProfiles(stillHereYo);

      // console.log(logs)
      const hasJoined = logs.find((h) => h.lensHandle === defaultProfile.handle);
      console.log(`hasJoined`, hasJoined);

      // publish a message to the stream
      const message = {
        type: "JOIN",
        clubSpaceId: clubSpaceObject.clubSpaceId,
        lensHandle: defaultProfile.handle,
      };
      console.log("publishing JOIN....");
      window.client.publish(STREAMR_PUBLIC_ID, message);

      if (isEmpty(hasJoined)) {
        // log the impression for this clubspace
        logPrivy({
          address,
          semGroupIdHex: clubSpaceObject.semGroupIdHex,
          impression: "JOIN",
        });
      }

      console.log("liveProfiles");
      console.log(liveProfiles);

      setIsLoadingEntry(false); // TODO: lucas - render the stuff
    });
  };

  // load stream history with this `clubSpaceId`
  // check if there is one with our lensHandle + type: joined
  // if not
  // - send JOINED event
  // - log privy impression with profileId/postId
  useEffect(() => {
    if (defaultProfile) {
      handleEntry();

      window.onbeforeunload = () => {
        const message = {
          type: "LEAVE",
          clubSpaceId: clubSpaceObject.clubSpaceId,
          lensHandle: defaultProfile.handle,
        };
        console.log("publishing LEAVE....");
        window.client.publish(STREAMR_PUBLIC_ID, message);
      };
      return () => {
        window.client.unsubscribe(STREAMR_PUBLIC_ID);
        // publish a message to the stream
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultProfile]);

  const onMessage = (content, metadata) => {
    if (content.lensHandle === defaultProfile.handle) return;
    if (content.clubSpaceId !== clubSpaceObject.clubSpaceId) return;
    console.log("MESSAGE RECEIVED");
    console.log(content);

    if (content.type === "JOIN") {
      liveProfiles.push(content.lensHandle);
      setLiveProfiles(liveProfiles);
    } else if (content.type === "LEAVE") {
      const idx = liveProfiles.findIndex((l) => l === content.lensHandle);
      liveProfiles.splice(idx, 1);
      setLiveProfiles(liveProfiles);
    } else if (content.type === "REACTION") {
      // TODO: lucas - set animation `content.reactionUnicode`
    }
  };

  const sendMessage = (reactionUnicode: string) => {
    const message = {
      type: "REACTION",
      clubSpaceId: clubSpaceObject.clubSpaceId,
      reactionUnicode,
      lensHandle: defaultProfile?.handle,
    };
    console.log("publishing REACTION....");
    window.client.publish(STREAMR_PUBLIC_ID, message);
  };

  if (!clubSpaceObject) {
    push("/404");
    return;
  }
  if (isLoadingEntry) {
    return <>Entering the ClubSpace...</>;
  }

  return (
    <>
      <p>Latest message: {latestMessage}</p>
      <button
        className="flex w-36 justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        onClick={() => sendMessage("👏")}
      >
        Send 👏
      </button>
    </>
  );
};

export default LiveSpace;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const {
    query: { handle },
  } = context;

  try {
    const data = await redisClient.get(handle);
    if (!data) return { props: {} };

    const clubSpaceObject = JSON.parse(data);
    console.log(clubSpaceObject);

    return { props: { clubSpaceObject } };
  } catch (error) {
    console.log(error);
  }

  return { props: {} };
};

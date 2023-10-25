import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/router";
import { useAccount } from "wagmi";
import "@livekit/components-styles";
import useENS from "@/hooks/useENS";
import { useGetProfilesOwned } from "@/services/lens/getProfile";
import { LiveVideo } from "@/components/live/LiveVideo";
import { LiveDiscussion } from "@/components/live/LiveDiscussion";
import { ConnectWallet } from "@/components/ConnectWallet";
import { GetServerSideProps } from "next";
import redisClient from "@/lib/utils/redisClient";
// import { ClubSpaceObject, GateData } from "@/components/LiveSpace";
import { SpaceEnded } from "@/components/SpaceEnded";
import { REDIS_SPACE_PREFIX } from "@/lib/consts";
import { generateName } from "@/lib/utils/nameGenerator";
import { NextPageWithLayout } from "./_app";

const LivePageAtHandle: NextPageWithLayout = ({ space }: { space: any | undefined }) => {
  // const [preJoinChoices, setPreJoinChoices] = useState<LocalUserChoices | undefined>(undefined);

  const {
    query: { handle },
  } = useRouter();

  const { isConnected, address } = useAccount();
  const { data: profilesResponse, isLoading: isLoadingProfiles } = useGetProfilesOwned({}, address);
  // const {
  //   data: meetsGatedCondition,
  //   isLoading: isLoadingMeetsGated,
  //   refetch: refetchMeetsGatedCondition,
  // } = useMeetsGatedCondition(address, getAccessToken(), space);
  const { data: ensData, isLoading: isLoadingENS } = useENS(address);
  const [defaultProfile, setDefaultProfile] = useState();
  const [loadingDefaultProfile, setLoadingDefaultProfile] = useState(true);
  const [_canEnter, setCanEnter] = useState();

  // IF WE WANT BETTER SECURITY
  // const {
  //   data: signResult,
  //   error: signError,
  //   signMessage,
  // } = useSignMessage({
  //   onSuccess: () => {
  //     setIsHost(true);
  //   },
  // });

  const roomName = useMemo(() => space?.roomId, [space]);
  const userIdentity = useMemo(() => address ?? generateName(), [address]);

  useEffect(() => {
    if (!(isLoadingProfiles || isLoadingENS)) {
      // @ts-ignore
      const defaultProfile = profilesResponse ? profilesResponse?.defaultProfile : null;
      if (defaultProfile) {
        // the bare minimum
        setDefaultProfile({
          // @ts-ignore
          id: defaultProfile?.id,
          picture: defaultProfile.picture,
          handle: defaultProfile.handle,
        });
      }
      setLoadingDefaultProfile(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, isLoadingProfiles, isLoadingENS]);

  // const preJoinSubmit = (values: LocalUserChoices) => {
  //   console.log("Joining with: ", values);
  //   // check for host
  //   // if(defaultProfile?.id === space.creatorLensProfileId)
  //   if (defaultProfile && defaultProfile?.handle === handle) {
  //     const message = `I am the host ${handle}`;
  //     signMessage({ message });
  //     if (signError) {
  //       alert("failed to verify host");
  //     } else {
  //       // set host or smth in metadata
  //       setIsHost(true);
  //     }
  //   }

  //   setPreJoinChoices(values);
  // };

  // useEffect(() => {
  //   if (!isLoadingMeetsGated) {
  //     setCanEnter(meetsGatedCondition);
  //   }
  // }, [isLoadingMeetsGated, meetsGatedCondition]);

  // const canEnter = useMemo(() => {
  //   // check for host first
  //   if (space?.creatorLensProfileId === defaultProfile?.id) {
  //     setIsHost(true);
  //     return true; // is host
  //   }
  //   // @FIXME: gated is only an object or undefined, so this validation with TIER_OPEN
  //   // doesn't make sense
  //   // @see {@link CreateSpace} at 323
  //   if (!space?.gated || space?.gated === TIER_OPEN) return true; // not gated

  //   return _canEnter !== false;
  // }, [defaultProfile, space, _canEnter]);

  if (!space) {
    return <SpaceEnded handle={handle as string} />;
  }

  if (!isConnected) {
    return (
      <div className="flex-1 min-h-screen">
        <div className="abs-center items-center">
          <p className="animate-move-txt-bg gradient-txt text-4xl mb-4">Connect your wallet to join</p>
          <ConnectWallet />
        </div>
      </div>
    );
  }

  if (isConnected && loadingDefaultProfile) {
    return (
      <div className="flex-1 min-h-screen">
        <div className="abs-center items-center">
          <p className="animate-move-txt-bg gradient-txt text-4xl mb-4">Joining...</p>
        </div>
      </div>
    );
  }

  // if (status === "connected" && userIdentity === "user-identity") {
  //   return <>loading...</>;
  // }

  // if (space.gated && (!getAccessToken() || canEnter === false)) {
  //   return (
  //     <SpaceGated
  //       handle={space.handle}
  //       gated={space.gated as GateData}
  //       creatorLensProfileId={space.creatorLensProfileId}
  //       lensPubId={space.lensPubId}
  //       refetchMeetsGatedCondition={refetchMeetsGatedCondition}
  //     />
  //   );
  // }

  if (space.spaceType === "video") {
    return (
      <LiveVideo
        // preJoinSubmit={preJoinSubmit}
        roomName={roomName}
        // preJoinChoices={preJoinChoices}
        userIdentity={userIdentity}
        defaultProfile={defaultProfile}
        ensData={ensData}
        space={space}
      />
    );
  }

  if (space.spaceType === "discussion") {
    return (
      <LiveDiscussion
        // preJoinSubmit={preJoinSubmit}
        roomName={roomName}
        // preJoinChoices={preJoinChoices}
        userIdentity={userIdentity}
        defaultProfile={defaultProfile}
        space={space}
      />
    );
  }

  // @TODO: create component from old [handle] page and pass props from here
  return <>{space.spaceType === "playlist" && <>go to old infra</>}</>;
};

LivePageAtHandle.getLayout = (page) => <>{page}</>;

export default LivePageAtHandle;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const {
    query: { handle },
  } = context;

  // should never happen
  if (!handle || handle === "<no source>")
    return {
      notFound: true,
    };

  try {
    let space = await redisClient.get(`${REDIS_SPACE_PREFIX}/${handle}`);

    if (!space) {
      console.log("SPACE NOT FOUND! MAY HAVE EXPIRED FROM REDIS");
      return {
        // we need to have the handle in the _app when there's no space
        // to provide the correct iframely link
        props: { handle },
      };
    } else {
      space = JSON.parse(space);
    }

    console.log(`found space with roomId: ${space.roomId}`);
    console.log(JSON.stringify(space, null, 2));

    return { props: { space } };
  } catch (error) {
    console.log(error);
  }

  return {
    notFound: true,
  };
};

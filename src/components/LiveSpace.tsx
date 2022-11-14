import { FC, Fragment, useEffect, useState, useCallback } from "react";
import { Dialog, Menu, Popover, Transition } from "@headlessui/react";
import { useJam } from "@/lib/jam-core-react";
import { isEmpty } from "lodash/lang";
import { classNames } from "@/lib/utils/classNames";
import { joinGroup } from "@/lib/semaphore/semaphore";
import { Profile, useGetProfilesByHandles, useGetProfilesOwned } from "@/services/lens/getProfile";
import { getUrlForImageFromIpfs } from "@/utils/ipfs";
import { LensProfile, reactionsEntries } from "@/components/LensProfile";
import useIdentity from "@/hooks/useIdentity";
import useIsMounted from "@/hooks/useIsMounted";
import useUnload from "@/hooks/useUnload";
import * as mockIdentities from "@/constants/mockIdentities.json";

type ClubSpaceObject = {
  clubSpaceId: string;
  createdAt: number;
  creatorAddress: string;
  creatorLensHandle: string;
  creatorLensProfileId: string;
  decentContractAddress: string;
  endAt: number;
  lensPubId: string;
  semGroupIdHex: string;
  spinampPlaylistId: string;
};

type LensProfileObject = {
  id: string;
  name: string;
  bio: string;
  picture: any;
  handle: string;
  coverPicture: any;
  ownedBy: string;
  stats: any;
};

type Props = {
  clubSpaceObject: ClubSpaceObject;
  defaultProfile: LensProfileObject;
  address: string;
  isLoadingEntry: boolean;
  setIsLoadingEntry: any;
  handle: boolean;
};

/**
 * This component takes club space data object and handles any live aspects with streamr
 * - connect to the streamr pub/sub client
 * - load the history for profiles that joined and left
 * - attempt to log an impression to privy store + join goody bag semaphore group
 * - party
 */
const LiveSpace: FC<Props> = ({
  clubSpaceObject,
  defaultProfile,
  address,
  isLoadingEntry,
  setIsLoadingEntry,
  handle,
}) => {
  const { identity } = useIdentity();
  const isMounted = useIsMounted();
  const [{ identities, myIdentity, reactions }, { enterRoom, leaveRoom, setProps, updateInfo, sendReaction }] =
    useJam();
  const [currentReaction, setCurrentReaction] = useState<{ type: string; handle: string; reactionUnicode: string }[]>();
  const [connectedPeers, setConnectedPeers] = useState<string[]>();

  let [isOpen, setIsOpen] = useState<boolean>(false);

  function Envelope() {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="368.625"
        height="368.625"
        viewBox="0 0 368.625 368.325"
        enableBackground="new 0 0 368.625 368.625"
        style={{ width: "20px", height: "20px" }}
        className="fill-black dark:fill-gray-300"
      >
        <path d="M356.125 50.318H12.5c-6.903 0-12.5 5.597-12.5 12.5v242.988c0 6.902 5.597 12.5 12.5 12.5h343.625c6.902 0 12.5-5.598 12.5-12.5V62.818c0-6.902-5.598-12.5-12.5-12.5zm-12.5 242.989H25V75.318h318.625v217.989z"></path>
        <path d="M57.755 134.201l120 73.937c2.01 1.239 4.283 1.858 6.557 1.858s4.547-.619 6.557-1.858l120-73.937c5.877-3.621 7.707-11.322 4.086-17.199s-11.324-7.707-17.199-4.085l-113.444 69.896-113.443-69.896c-5.875-3.619-13.576-1.793-17.199 4.085-3.622 5.876-1.793 13.578 4.085 17.199z"></path>
      </svg>
    );
  }

  function toggleDrawer() {
    setIsOpen((currentState) => !currentState);
  }

  function closeModal() {
    setIsOpen(false);
  }

  useEffect(() => {
    const join = async () => {
      await setProps("roomId", clubSpaceObject.clubSpaceId);
      await updateInfo({
        handle,
        profile: {
          avatar: defaultProfile?.picture?.original?.url,
          name: defaultProfile?.name,
          totalFollowers: defaultProfile?.stats?.totalFollowers,
        },
      });
      console.log(`JOINING: ${clubSpaceObject.clubSpaceId}`);
      await enterRoom(clubSpaceObject.clubSpaceId);
      console.log('JOINED');

      // USER IS IN
      setIsLoadingEntry(false);
    };

    if (isMounted && isLoadingEntry) {
      join();
    }
  }, [isMounted]);

  useUnload(async () => {
    console.log(`LEAVING`);
    await leaveRoom(clubSpaceObject.clubSpaceId);
  });

  // @TODO: run if prev != new
  useEffect(() => {
    console.log("identities", identities);
    console.log("keys", Object.keys(identities));

    setConnectedPeers(Object.keys(identities));
  }, [identities]);

  // @TODO: run if prev != new
  useEffect(() => {
    console.log(reactions);
  }, [reactions]);

  if (isLoadingEntry) return null;

  return (
    <>
      <div className="grid-container">
        {connectedPeers &&
          connectedPeers?.map((peerId, index) => {
            return (
              <LensProfile
                key={identities[peerId].handle}
                handle={identities[peerId].handle}
                picture={identities[peerId].profile ? getUrlForImageFromIpfs(identities[peerId].profile.avatar) : ""}
                name={identities[peerId].profile?.name}
                totalFollowers={identities[peerId].profile?.totalFollowers}
                reaction={isEmpty(reactions[peerId]) ? null : reactions[peerId][0]}
                index={index}
              />
            );
          })}
        {/**mockIdentities.identities.map(({ id, handle, profile }, index) => (
          <LensProfile
            id={id}
            key={handle}
            handle={handle}
            picture={profile ? getUrlForImageFromIpfs(profile.avatar) : ""}
            name={profile?.name}
            totalFollowers={profile?.totalFollowers}
            index={index}
            onClick={toggleDrawer}
          />
        ))*/}
      </div>

      <Popover
        className={({ open }) =>
          classNames(
            open ? "fixed inset-0 z-40 overflow-y-auto" : "",
            "shadow-sm lg:static bottom-0 lg:overflow-y-visible"
          )
        }
      >
        {({ open }) => (
          <>
            <Menu as="div" className="relative flex-shrink-0">
              <div className="w-36 flex gap-4 mt-4">
                <Menu.Button className="btn" disabled={!defaultProfile}>
                  react
                </Menu.Button>
              </div>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute z-10 mt-2 w-48 origin-top-right rounded-md bg-white dark:bg-gray-800 p-4 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none flex gap-4 flex-wrap">
                  {reactionsEntries.map(([key, value]) => (
                    <Menu.Item key={value}>
                      {({ active }) => <button onClick={async () => await sendReaction(value)}>{value}</button>}
                    </Menu.Item>
                  ))}
                </Menu.Items>
              </Transition>
            </Menu>

            <Popover.Panel className="" aria-label="Global"></Popover.Panel>
          </>
        )}
      </Popover>

      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={closeModal}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed bottom-[-20px] left-1/2 transform -translate-x-1/2 w-[375px]">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300 transform"
                enterFrom="opacity-0 scale-95 translate-y-[100%]"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200 transform"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95 translate-y-[100%]"
              >
                <Dialog.Panel className="relative w-full max-w-md transform overflow-hidden rounded-tl-[35px] rounded-tr-[35px] bg-white dark:bg-black p-6 text-left align-middle shadow-xl transition-all min-h-[20rem] pt-[155px]">
                  <div className="absolute top-0 right-0 h-[130px] bg-cover bg-[url('https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fnftevening.com%2Fwp-content%2Fuploads%2F2022%2F03%2FLIST-APE-ART-1024x576.png&f=1&nofb=1&ipt=83eca6574d793e1023a961cd605caa6fd4f7afbe580fd6c4ce4509f70d4e39b3&ipo=images')] w-full">
                    <img
                      src="https://cdn.stamp.fyi/avatar/eth:0x2954dbfbbdf8dafd86c8dcace63b26796ef2bf52?s=250"
                      alt=""
                      className="rounded-full w-12 h-12 aspect-square relative border-black-[4px] top-3/4 left-[5%] outline outline-offset-0 outline-4 outline-black"
                    />
                  </div>
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <div className="mb-[-3px] dark:text-white">
                          <span>First</span> | <span>last</span>
                        </div>
                        <div className="text-gray-500">@Handle</div>
                      </div>

                      <button className="!w-auto btn">Follow</button>
                    </div>
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 dark:text-white mb-6">
                      Co-founder of Ape Space and supreme ruler of the best NFT universe.
                    </p>

                    <button className="flex gap-x-4 items-center">
                      <Envelope />
                      <span>Send Direct Message</span>
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};

export default LiveSpace;

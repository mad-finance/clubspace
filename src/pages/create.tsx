import CreateLensPost from "@/components/CreateLensPost";
import SelectPlaylist from "@/components/SelectPlaylist";
import SetDecentProduct from '@/components/SetDecentProduct';
import { IPlaylist } from "@spinamp/spinamp-sdk";
import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useGetProfilesOwned } from "@/services/lens/getProfile";

const CreateSpace = () => {
  const { address } = useAccount();
  const [playlist, setPlaylist] = useState<IPlaylist>();
  const [productData, setProductData] = useState<any>();
  const [lensPost, setLensPost] = useState<any>();
  const [defaultProfile, setDefaultProfile] = useState();
  const { isLoading: loadingProfiles, data: profiles } = useGetProfilesOwned(address);

  useEffect(() => {
    if (profiles?.length) {
      console.log(profiles[0]);
      setDefaultProfile(profiles[0]);
    }
  }, [address, profiles]);

  const selectPlaylist = (playlist) => {
    setPlaylist(playlist);
  };

  const setDecentProduct = (data) => {
    console.log(data);
    setProductData(data);
  };

  const setPostData = (postData) => {
    setLensPost(postData)
  }

  const submit = () => {
    // TODO: send all api calls
  };

  return (
    <div className="">
      <p>Create a Space</p>
      {!playlist ? <SelectPlaylist selectPlaylist={selectPlaylist} /> : <p>Playlist: {playlist.title}</p>}
      {!productData ? <SetDecentProduct setDecentProduct={setDecentProduct} /> : <p>NFT FOUND! RENDER AN NFT COMPONENT</p>}
      {!lensPost ? <CreateLensPost setPostData={setPostData}/> : null }
    </div>
  );
};

export default CreateSpace;

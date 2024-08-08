import { useQuery } from "@tanstack/react-query";
import { lensClient } from "@/services/lens/client";

export const getAccessToken = async () => {
  const accessTokenResult = await lensClient.authentication.getAccessToken();
  return accessTokenResult.unwrap();
};

export const useAuthenticatedAccessToken = () => {
  return useQuery({
    queryKey: ["lens-authenticated-access-token"],
    queryFn: async () => {
      return await getAccessToken();
    },
    enabled: true,
  });
};

export const useAuthenticatedProfileId = () => {
  return useQuery({
    queryKey: ["lens-authenticated-profileId"],
    queryFn: async () => {
      // TODO: use the results of the orb jwt token
      return await lensClient.authentication.getProfileId();
    },
    enabled: true,
  });
};

export const useIsAuthenticated = () => {
  return useQuery({
    queryKey: ["lens-authenticated"],
    queryFn: async () => {
      return await lensClient.authentication.isAuthenticated();
    },
    enabled: true,
  });
};

export const useAuthenticatedProfile = () => {
  return useQuery({
    queryKey: ["lens-authenticated-profile"],
    queryFn: async () => {
      const profileId = await lensClient.authentication.getProfileId();
      return await lensClient.profile.fetch({ forProfileId: profileId });
    },
    enabled: true,
  });
};
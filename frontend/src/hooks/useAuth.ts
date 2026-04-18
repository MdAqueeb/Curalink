import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi, type AuthUser } from "@/api/auth";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => authApi.getMe().then((r: { data: { data: AuthUser } }) => r.data.data),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.register,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => queryClient.clear(),
  });
}

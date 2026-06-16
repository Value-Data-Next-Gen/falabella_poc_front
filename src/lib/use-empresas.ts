import { useQuery } from '@tanstack/react-query'
import { listEmpresas } from '@/api/sdk.gen'

export function useEmpresas() {
  return useQuery({
    queryKey: ['empresas'],
    queryFn: () => listEmpresas(),
    select: (res) => res.data ?? [],
  })
}

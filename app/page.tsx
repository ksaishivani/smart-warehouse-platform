import { StoreProvider } from "@/lib/store"
import { AppShell } from "@/components/app-shell"

export default function Page() {
  return (
    <StoreProvider>
      <AppShell />
    </StoreProvider>
  )
}

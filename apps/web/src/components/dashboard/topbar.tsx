import { Avatar, AvatarFallback, Input } from '@finance-os/ui/components'

export function Topbar() {
  return (
    <header className="h-14 border-b bg-background px-4 flex items-center gap-3">
      <Input
        placeholder="Rechercher une transaction, un compte, un actif..."
        className="max-w-xl"
      />
      <div className="ml-auto">
        <Avatar className="h-8 w-8">
          <AvatarFallback>BZ</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}

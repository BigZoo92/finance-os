import { Badge, Separator } from '@finance-os/ui/components'

const items = [
  { label: 'Dashboard', soon: false },
  { label: 'Dépenses', soon: true },
  { label: 'Patrimoine', soon: true },
  { label: 'Actualités', soon: true },
  { label: 'Recommandations IA', soon: true },
  { label: 'Connecteurs', soon: true },
]

export function SidebarNav() {
  return (
    <aside className="hidden md:flex md:w-64 md:flex-col border-r bg-background">
      <div className="h-14 px-4 flex items-center">
        <div className="font-semibold tracking-tight">Finance OS</div>
      </div>

      <Separator />

      <nav className="p-3 space-y-1">
        {items.map(item => (
          <button
            key={item.label}
            type="button"
            className="w-full flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted text-left"
          >
            <span>{item.label}</span>
            {item.soon ? <Badge variant="outline">Soon</Badge> : null}
          </button>
        ))}
      </nav>
    </aside>
  )
}

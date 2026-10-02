import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './dialog'
import { Drawer, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from './drawer'

describe('overlay static parts', () => {
  it('render dialog parts with their slots and atoms', () => {
    const html = renderToStaticMarkup(
      <Dialog open>
        <DialogHeader>
          <DialogTitle>Titre</DialogTitle>
          <DialogDescription>Description</DialogDescription>
        </DialogHeader>
        <DialogFooter className="legacy" mt="2" />
      </Dialog>
    )
    expect(html).toContain('data-slot="dialog-header"')
    expect(html).toContain('data-slot="dialog-title"')
    expect(html).toContain('data-slot="dialog-description"')
    expect(html).toContain('data-slot="dialog-footer"')
    expect(html).toContain('textStyle_md')
    expect(html).toContain('fs_13px')
    expect(html).toContain('legacy')
    expect(html).toContain('mt_2')
  })

  it('render drawer parts with their slots and atoms', () => {
    const html = renderToStaticMarkup(
      <Drawer open>
        <DrawerHeader>
          <DrawerTitle>Titre</DrawerTitle>
          <DrawerDescription>Description</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter />
      </Drawer>
    )
    expect(html).toContain('data-slot="drawer-header"')
    expect(html).toContain('data-slot="drawer-title"')
    expect(html).toContain('data-slot="drawer-description"')
    expect(html).toContain('data-slot="drawer-footer"')
    expect(html).toContain('px_5')
    expect(html).toContain('mt_auto')
  })
})

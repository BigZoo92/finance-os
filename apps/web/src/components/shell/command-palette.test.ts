// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { isEditableTarget } from './command-palette'

describe('command palette editable-field guard', () => {
  it('treats form controls as editable', () => {
    expect(isEditableTarget(document.createElement('input'))).toBe(true)
    expect(isEditableTarget(document.createElement('textarea'))).toBe(true)
    expect(isEditableTarget(document.createElement('select'))).toBe(true)
  })

  it('treats contenteditable regions and their children as editable', () => {
    const region = document.createElement('div')
    region.setAttribute('contenteditable', 'true')
    const child = document.createElement('span')
    region.appendChild(child)
    document.body.appendChild(region)
    expect(isEditableTarget(region)).toBe(true)
    expect(isEditableTarget(child)).toBe(true)
    region.remove()

    const disabled = document.createElement('div')
    disabled.setAttribute('contenteditable', 'false')
    document.body.appendChild(disabled)
    expect(isEditableTarget(disabled)).toBe(false)
    disabled.remove()
  })

  it('lets the shortcut fire from non-editable targets', () => {
    expect(isEditableTarget(document.body)).toBe(false)
    expect(isEditableTarget(document.createElement('button'))).toBe(false)
    expect(isEditableTarget(null)).toBe(false)
  })
})

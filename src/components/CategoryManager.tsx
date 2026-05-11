import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { uid } from '../storage'
import {
  Category,
  META_SONSTIGES_ID,
  MetaCategory,
  SONSTIGES_ID,
} from '../types'
import { Icon, IconPicker } from './IconPicker'
import { metaSoftBg } from './metaColors'

interface Props {
  categories: Category[]
  metaCategories: MetaCategory[]
  onCategoriesChange: (cats: Category[]) => void
  onMetaCategoriesChange: (metas: MetaCategory[]) => void
  onDeleteCategory: (id: string) => void
  onDeleteMeta: (id: string) => void
}

export function CategoryManager({
  categories,
  metaCategories,
  onCategoriesChange,
  onMetaCategoriesChange,
  onDeleteCategory,
  onDeleteMeta,
}: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<Category | null>(null)
  const [editingMeta, setEditingMeta] = useState<string | null>(null)
  const [metaDraft, setMetaDraft] = useState<MetaCategory | null>(null)

  function startEdit(c: Category) {
    setEditing(c.id)
    setDraft({ ...c })
  }
  function commit() {
    if (!draft) return
    onCategoriesChange(categories.map((c) => (c.id === draft.id ? draft : c)))
    setEditing(null)
    setDraft(null)
  }
  function addNewCat() {
    const c: Category = {
      id: uid('cat'),
      name: 'Neue Subkategorie',
      icon: 'Package',
      color: '#6366f1',
    }
    onCategoriesChange([...categories, c])
    startEdit(c)
  }
  function addMeta() {
    const m: MetaCategory = {
      id: uid('meta'),
      name: 'Neue Hauptkategorie',
      icon: 'Package',
      color: '#6366f1',
    }
    onMetaCategoriesChange([...metaCategories, m])
    setEditingMeta(m.id)
    setMetaDraft({ ...m })
  }
  function commitMeta() {
    if (!metaDraft) return
    onMetaCategoriesChange(
      metaCategories.map((m) => (m.id === metaDraft.id ? metaDraft : m)),
    )
    setEditingMeta(null)
    setMetaDraft(null)
  }

  return (
    <div className='cat-manager'>
      {/* ---- Hauptkategorien ---- */}
      <div className='cat-manager-head'>
        <h3>Hauptkategorien</h3>
        <button className='btn btn-primary' onClick={addMeta}>
          <Plus size={16} /> Hauptkategorie
        </button>
      </div>

      <div className='meta-groups'>
        {metaCategories.map((meta) => {
          const isMetaEditing = editingMeta === meta.id
          const md = isMetaEditing && metaDraft ? metaDraft : meta
          const metaLocked = meta.id === META_SONSTIGES_ID
          return (
            <section key={meta.id} className='meta-group'>
              <header
                className='meta-group-head'
                style={{
                  background: metaSoftBg(md.color),
                  borderLeft: `4px solid ${md.color}`,
                }}
              >
                <div className='meta-group-title'>
                  <div className='cat-badge' style={{ background: md.color }}>
                    <Icon name={md.icon} size={16} color='#fff' />
                  </div>
                  {isMetaEditing ? (
                    <input
                      className='inline-input'
                      value={md.name}
                      onChange={(e) =>
                        setMetaDraft({ ...md, name: e.target.value })
                      }
                    />
                  ) : (
                    <h4>{meta.name}</h4>
                  )}
                  {isMetaEditing && (
                    <input
                      type='color'
                      value={md.color}
                      onChange={(e) =>
                        setMetaDraft({ ...md, color: e.target.value })
                      }
                      title='Farbe'
                    />
                  )}
                </div>
                <div className='meta-group-actions'>
                  {isMetaEditing ? (
                    <>
                      <button
                        className='btn btn-icon'
                        onClick={commitMeta}
                        title='Speichern'
                      >
                        <Check size={16} />
                      </button>
                      <button
                        className='btn btn-icon'
                        onClick={() => {
                          setEditingMeta(null)
                          setMetaDraft(null)
                        }}
                        title='Abbrechen'
                      >
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className='btn btn-icon'
                        disabled={metaLocked}
                        onClick={() => {
                          setEditingMeta(meta.id)
                          setMetaDraft({ ...meta })
                        }}
                        title={
                          metaLocked
                            ? 'Sonstiges kann nicht bearbeitet werden'
                            : 'Bearbeiten'
                        }
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className='btn btn-icon danger'
                        disabled={metaLocked}
                        onClick={() => onDeleteMeta(meta.id)}
                        title={
                          metaLocked
                            ? 'Sonstiges kann nicht gelöscht werden'
                            : 'Hauptkategorie löschen'
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </header>

              {isMetaEditing && (
                <div className='meta-icon-picker'>
                  <IconPicker
                    value={md.icon}
                    onChange={(n) => setMetaDraft({ ...md, icon: n })}
                  />
                </div>
              )}
            </section>
          )
        })}
      </div>

      {/* ---- Subkategorien (global) ---- */}
      <div className='cat-manager-head' style={{ marginTop: 24 }}>
        <h3>Subkategorien</h3>
        <button className='btn btn-primary' onClick={addNewCat}>
          <Plus size={16} /> Subkategorie
        </button>
      </div>

      <ul className='cat-list'>
        {categories.map((c) => {
          const isEditing = editing === c.id
          const d = isEditing && draft ? draft : c
          const locked = c.id === SONSTIGES_ID
          return (
            <li key={c.id} className='cat-row'>
              <div className='cat-row-main'>
                <div className='cat-badge' style={{ background: d.color }}>
                  <Icon name={d.icon} size={16} color='#fff' />
                </div>
                {isEditing ? (
                  <input
                    className='inline-input'
                    value={d.name}
                    onChange={(e) => setDraft({ ...d, name: e.target.value })}
                  />
                ) : (
                  <span className='cat-name'>{c.name}</span>
                )}
                {isEditing && (
                  <input
                    type='color'
                    value={d.color}
                    onChange={(e) => setDraft({ ...d, color: e.target.value })}
                  />
                )}
              </div>
              <div className='cat-row-actions'>
                {isEditing ? (
                  <>
                    <button
                      className='btn btn-icon'
                      onClick={commit}
                      title='Speichern'
                    >
                      <Check size={16} />
                    </button>
                    <button
                      className='btn btn-icon'
                      onClick={() => {
                        setEditing(null)
                        setDraft(null)
                      }}
                      title='Abbrechen'
                    >
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className='btn btn-icon'
                      onClick={() => startEdit(c)}
                      title='Bearbeiten'
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className='btn btn-icon danger'
                      disabled={locked}
                      onClick={() => onDeleteCategory(c.id)}
                      title={
                        locked
                          ? 'Sonstiges kann nicht gelöscht werden'
                          : 'Löschen'
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
              {isEditing && (
                <div className='cat-row-picker'>
                  <IconPicker
                    value={d.icon}
                    onChange={(n) => setDraft({ ...d, icon: n })}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

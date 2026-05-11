import { icons, LucideProps } from 'lucide-react'
import { useMemo, useState } from 'react'

const POPULAR = [
  'Home',
  'Car',
  'ShieldCheck',
  'Repeat',
  'Package',
  'Zap',
  'Flame',
  'Droplet',
  'Wifi',
  'Smartphone',
  'Tv',
  'Music',
  'Gamepad2',
  'Dumbbell',
  'HeartPulse',
  'Stethoscope',
  'GraduationCap',
  'BookOpen',
  'PiggyBank',
  'CreditCard',
  'Banknote',
  'Wallet',
  'ShoppingCart',
  'Utensils',
  'Coffee',
  'Baby',
  'Cat',
  'Dog',
  'Plane',
  'Train',
  'Bus',
  'Bike',
  'Fuel',
  'ParkingCircle',
  'Briefcase',
  'Building',
  'Hammer',
  'Wrench',
  'Lightbulb',
  'Sun',
  'Cloud',
  'Trees',
  'Flower2',
  'Gift',
  'Cake',
  'PartyPopper',
  'Camera',
  'Globe',
]

export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp = (icons as any)[name] ?? icons.Package
  return <Cmp {...props} />
}

export function IconPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (n: string) => void
}) {
  const [query, setQuery] = useState('')
  const all = useMemo(() => Object.keys(icons), [])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? all.filter((n) => n.toLowerCase().includes(q)) : POPULAR
    return list.slice(0, 96)
  }, [query, all])

  return (
    <div className='icon-picker'>
      <input
        type='text'
        placeholder='Icon suchen…'
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className='icon-grid'>
        {filtered.map((n) => (
          <button
            key={n}
            type='button'
            className={`icon-cell ${n === value ? 'active' : ''}`}
            onClick={() => onChange(n)}
            title={n}
          >
            <Icon name={n} size={18} />
          </button>
        ))}
      </div>
    </div>
  )
}

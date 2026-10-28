// Pixel icons in place of lucide-react: vite.config.ts and tsconfig.app.json point the
// 'lucide-react' import here, so every `import { X } from 'lucide-react'` gets lucide's own
// drawing turned into pixels (scripts/build-pixel-icons.mjs writes pixel-icons.data.ts).
// Each icon is drawn at a size where one of its pixels is a whole number of CSS pixels
// (16, 24, 32 or 48), so the edges stay sharp. Adding an icon: import it as usual, run the
// script, and add its line at the end of this file.

import type { CSSProperties, ReactElement, SVGProps } from 'react'
import { ICONS } from './pixel-icons.data'
import './pixel-pieces.css'

export interface LucideProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  size?: number | string
  /** kept for lucide compatibility; pixel lines have one width */
  strokeWidth?: number | string
  absoluteStrokeWidth?: boolean
  title?: string
}
export type LucideIcon = ((props: LucideProps) => ReactElement) & { displayName?: string }

/** The nearest whole-pixel size: the 16 grid at 16 or 32 px, the 24 grid at 24 or 48 px. */
function fit(size: number) {
  if (size < 20) return { grid: 16, px: 16 }
  if (size < 29) return { grid: 24, px: 24 }
  if (size < 41) return { grid: 16, px: 32 }
  return { grid: 24, px: 48 }
}

const kebab = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

function icon(name: keyof typeof ICONS): LucideIcon {
  const [small, smallInside, large, largeInside] = ICONS[name]
  // one component per icon, made once at load like lucide's own; fast refresh just reloads this module
  // oxlint-disable-next-line react/only-export-components
  const Icon = ({ size = 24, strokeWidth: _w, absoluteStrokeWidth: _a, title, className = '', color, style, ...rest }: LucideProps) => {
    const { grid, px } = fit(Number(size) || 24)
    const label = rest['aria-label']
    const css: CSSProperties | undefined = color ? { color, ...style } : style
    const inside = grid === 16 ? smallInside : largeInside
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={px}
        height={px}
        viewBox={`0 0 ${grid} ${grid}`}
        fill="none"
        shapeRendering="crispEdges"
        className={`px-icon lucide lucide-${kebab(name)} ${className}`.trim()}
        aria-hidden={label || title ? undefined : true}
        role={label || title ? 'img' : undefined}
        style={css}
        {...rest}
      >
        {title && <title>{title}</title>}
        <path fill="currentColor" d={grid === 16 ? small : large} />
        {inside && <path d={inside} />}
      </svg>
    )
  }
  Icon.displayName = name
  return Icon
}

export const Activity = icon('Activity')
export const ArrowLeft = icon('ArrowLeft')
export const ArrowRight = icon('ArrowRight')
export const ArrowRightLeft = icon('ArrowRightLeft')
export const ArrowUp = icon('ArrowUp')
export const ArrowUpDown = icon('ArrowUpDown')
export const Award = icon('Award')
export const BellRing = icon('BellRing')
export const BookMarked = icon('BookMarked')
export const BookOpen = icon('BookOpen')
export const Bot = icon('Bot')
export const Brain = icon('Brain')
export const CalendarCheck = icon('CalendarCheck')
export const Castle = icon('Castle')
export const Check = icon('Check')
export const CheckCheck = icon('CheckCheck')
export const ChevronDown = icon('ChevronDown')
export const ChevronLeft = icon('ChevronLeft')
export const ChevronRight = icon('ChevronRight')
export const Clock = icon('Clock')
export const Cloud = icon('Cloud')
export const CloudOff = icon('CloudOff')
export const Compass = icon('Compass')
export const Contrast = icon('Contrast')
export const CornerUpLeft = icon('CornerUpLeft')
export const Crosshair = icon('Crosshair')
export const Crown = icon('Crown')
export const Download = icon('Download')
export const Dumbbell = icon('Dumbbell')
export const Eraser = icon('Eraser')
export const ExternalLink = icon('ExternalLink')
export const Eye = icon('Eye')
export const EyeOff = icon('EyeOff')
export const Flag = icon('Flag')
export const Flame = icon('Flame')
export const Footprints = icon('Footprints')
export const Gem = icon('Gem')
export const GraduationCap = icon('GraduationCap')
export const Grid3x3 = icon('Grid3x3')
export const Hand = icon('Hand')
export const Heart = icon('Heart')
export const History = icon('History')
export const LayoutGrid = icon('LayoutGrid')
export const Lightbulb = icon('Lightbulb')
export const ListTree = icon('ListTree')
export const Loader2 = icon('Loader2')
export const Lock = icon('Lock')
export const LogOut = icon('LogOut')
export const Magnet = icon('Magnet')
export const Mail = icon('Mail')
export const Map = icon('Map')
export const Medal = icon('Medal')
export const MessageCircleQuestion = icon('MessageCircleQuestion')
export const Microscope = icon('Microscope')
export const Moon = icon('Moon')
export const Play = icon('Play')
export const Puzzle = icon('Puzzle')
export const RefreshCw = icon('RefreshCw')
export const Repeat = icon('Repeat')
export const Rocket = icon('Rocket')
export const RotateCcw = icon('RotateCcw')
export const Search = icon('Search')
export const Settings = icon('Settings')
export const Shapes = icon('Shapes')
export const Share2 = icon('Share2')
export const Shield = icon('Shield')
export const ShieldCheck = icon('ShieldCheck')
export const Shuffle = icon('Shuffle')
export const Sparkles = icon('Sparkles')
export const Split = icon('Split')
export const Star = icon('Star')
export const Sun = icon('Sun')
export const Sunrise = icon('Sunrise')
export const Swords = icon('Swords')
export const Target = icon('Target')
export const Timer = icon('Timer')
export const Trash2 = icon('Trash2')
export const TrendingUp = icon('TrendingUp')
export const Trophy = icon('Trophy')
export const Undo2 = icon('Undo2')
export const Upload = icon('Upload')
export const User = icon('User')
export const UserRound = icon('UserRound')
export const Volume2 = icon('Volume2')
export const X = icon('X')
export const Zap = icon('Zap')

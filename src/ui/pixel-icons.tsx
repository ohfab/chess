// Pixel icons in place of lucide-react: vite.config.ts and tsconfig.app.json point the
// 'lucide-react' import here, so every `import { X } from 'lucide-react'` in the app gets a
// pixel drawing with the same name and props. Drawn on a 24-unit grid in 2-unit "pixels",
// filled with currentColor and rendered with crisp edges.
//
// Most shapes come from pixelarticons (MIT, Gerrit Halfmann, https://pixelarticons.com),
// read from the package at build time; the ones it lacks are drawn below as 12×12 pixel art.
// For shapes CSS can fill (a heart that turns red, a star that turns gold) the inside is a
// second path that takes the svg's `fill`, like the outline icons from lucide did.

import type { CSSProperties, ReactElement, SVGProps } from 'react'

import arrowLeft from 'pixelarticons/svg/arrow-left.svg?raw'
import arrowRight from 'pixelarticons/svg/arrow-right.svg?raw'
import arrowUp from 'pixelarticons/svg/arrow-up.svg?raw'
import bellRing from 'pixelarticons/svg/bell-ring.svg?raw'
import bookOpen from 'pixelarticons/svg/book-open.svg?raw'
import robotFace from 'pixelarticons/svg/robot-face.svg?raw'
import castle from 'pixelarticons/svg/castle.svg?raw'
import check from 'pixelarticons/svg/check.svg?raw'
import checkDouble from 'pixelarticons/svg/check-double.svg?raw'
import chevronDown from 'pixelarticons/svg/chevron-down.svg?raw'
import chevronLeft from 'pixelarticons/svg/chevron-left.svg?raw'
import chevronRight from 'pixelarticons/svg/chevron-right.svg?raw'
import clock from 'pixelarticons/svg/clock.svg?raw'
import cloud from 'pixelarticons/svg/cloud.svg?raw'
import compass from 'pixelarticons/svg/compass.svg?raw'
import cornerUpLeft from 'pixelarticons/svg/corner-up-left.svg?raw'
import crown from 'pixelarticons/svg/crown.svg?raw'
import download from 'pixelarticons/svg/download.svg?raw'
import eraser from 'pixelarticons/svg/eraser.svg?raw'
import externalLink from 'pixelarticons/svg/external-link.svg?raw'
import eye from 'pixelarticons/svg/eye.svg?raw'
import eyeOff from 'pixelarticons/svg/eye-off.svg?raw'
import flag from 'pixelarticons/svg/flag.svg?raw'
import fire from 'pixelarticons/svg/fire.svg?raw'
import diamondGem from 'pixelarticons/svg/diamond-gem.svg?raw'
import gps from 'pixelarticons/svg/gps.svg?raw'
import grid3x3 from 'pixelarticons/svg/grid-3x3.svg?raw'
import hand from 'pixelarticons/svg/hand.svg?raw'
import lightbulb from 'pixelarticons/svg/lightbulb.svg?raw'
import loader from 'pixelarticons/svg/loader.svg?raw'
import lock from 'pixelarticons/svg/lock.svg?raw'
import logout from 'pixelarticons/svg/logout.svg?raw'
import mail from 'pixelarticons/svg/mail.svg?raw'
import map from 'pixelarticons/svg/map.svg?raw'
import moon from 'pixelarticons/svg/moon.svg?raw'
import play from 'pixelarticons/svg/play.svg?raw'
import reload from 'pixelarticons/svg/reload.svg?raw'
import repeat from 'pixelarticons/svg/repeat.svg?raw'
import search from 'pixelarticons/svg/search.svg?raw'
import settingsCog from 'pixelarticons/svg/settings-cog.svg?raw'
import shapes from 'pixelarticons/svg/shapes.svg?raw'
import shield from 'pixelarticons/svg/shield.svg?raw'
import shuffle from 'pixelarticons/svg/shuffle.svg?raw'
import sortHorizontal from 'pixelarticons/svg/sort-horizontal.svg?raw'
import sortVertical from 'pixelarticons/svg/sort-vertical.svg?raw'
import sparkles from 'pixelarticons/svg/sparkles.svg?raw'
import sun from 'pixelarticons/svg/sun.svg?raw'
import target from 'pixelarticons/svg/target.svg?raw'
import trash from 'pixelarticons/svg/trash.svg?raw'
import trendingUp from 'pixelarticons/svg/trending-up.svg?raw'
import trophy from 'pixelarticons/svg/trophy.svg?raw'
import undo from 'pixelarticons/svg/undo.svg?raw'
import upload from 'pixelarticons/svg/upload.svg?raw'
import user from 'pixelarticons/svg/user.svg?raw'
import volume from 'pixelarticons/svg/volume-3.svg?raw'
import close from 'pixelarticons/svg/close.svg?raw'
import zap from 'pixelarticons/svg/zap.svg?raw'

export interface LucideProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  size?: number | string
  /** kept for lucide compatibility; pixel lines have one width */
  strokeWidth?: number | string
  absoluteStrokeWidth?: boolean
  title?: string
}
export type LucideIcon = ((props: LucideProps) => ReactElement) & { displayName?: string }

/** All path data of a pixelarticons svg, as one path. */
const pa = (svg: string) => [...svg.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]).join(' ')

/**
 * 12×12 pixel art to path data: `#` is the outline, `o` the inside that CSS may fill, anything
 * else is empty. The drawing is centred on the 24-unit grid, each character 2 units square.
 */
function art(rows: string): [string, string] {
  const lines = rows.split('\n').map((l) => l.trim()).filter(Boolean)
  const cells: [number, number, string][] = []
  lines.forEach((line, y) => [...line].forEach((ch, x) => (ch === '#' || ch === 'o') && cells.push([x, y, ch])))
  const xs = cells.map((c) => c[0])
  const ys = cells.map((c) => c[1])
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const dx = (24 - (maxX - minX + 1) * 2) / 2 - minX * 2
  const dy = (24 - (maxY - minY + 1) * 2) / 2 - minY * 2
  const out: Record<string, string> = { '#': '', o: '' }
  lines.forEach((line, y) => {
    for (const ch of ['#', 'o']) {
      // runs of the same character become one rectangle
      for (let x = 0; x < line.length; x++) {
        if (line[x] !== ch) continue
        let w = 1
        while (line[x + w] === ch) w++
        out[ch] += `M${x * 2 + dx} ${y * 2 + dy}h${w * 2}v2h${-w * 2}z`
        x += w - 1
      }
    }
  })
  return [out['#'], out.o]
}

function icon(name: string, [outline, inside = '']: [string, string?]): LucideIcon {
  // one component per drawing, made once at load like lucide's own; fast refresh just reloads this module
  // oxlint-disable-next-line react/only-export-components
  const Icon = ({ size = 24, strokeWidth: _w, absoluteStrokeWidth: _a, title, className = '', color, style, ...rest }: LucideProps) => {
    const label = rest['aria-label']
    const css: CSSProperties | undefined = color ? { color, ...style } : style
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        shapeRendering="crispEdges"
        className={`px-icon lucide lucide-${name} ${className}`.trim()}
        aria-hidden={label || title ? undefined : true}
        role={label || title ? 'img' : undefined}
        style={css}
        {...rest}
      >
        {title && <title>{title}</title>}
        <path fill="currentColor" d={outline} />
        {inside && <path d={inside} />}
      </svg>
    )
  }
  Icon.displayName = name
  return Icon
}

const p = (svg: string): [string] => [pa(svg)]

// ------------------------------------------------------------------ drawn here

const ACTIVITY = art(`
  ............
  ...#........
  ...#........
  ..#.#.......
  ..#.#.......
  ##...#...###
  .....#..#...
  ......#.#...
  ......#.#...
  .......#....
`)
const AWARD = art(`
  ....####....
  ...#....#...
  ..#..##..#..
  ..#.#..#.#..
  ..#.#..#.#..
  ..#..##..#..
  ...#....#...
  ...######...
  ...#....#...
  ...#....#...
  ...#.##.#...
  ...##..##...
`)
const BOOK_MARKED = art(`
  ############
  ##...###...#
  ##...###...#
  ##...###...#
  ##...###...#
  ##...#.#...#
  ##.........#
  ##.........#
  ##.........#
  ############
  ##.........#
  .###########
`)
const BRAIN = art(`
  ..###..###..
  .#...##...#.
  #..#.#..#..#
  #.#..#...#.#
  #....#.##..#
  .#.#.#....#.
  #..#.#.#...#
  #....#..#..#
  .#..#.#...#.
  ..##...###..
`)
const CALENDAR_CHECK = art(`
  ..#.....#..
  ###########
  #.........#
  ###########
  #.........#
  #.......#.#
  #......#..#
  #.#...#...#
  #..#.#....#
  #...#.....#
  #.........#
  ###########
`)
const CLOUD_OFF = art(`
  #...........
  .#...###....
  ..#.#...#...
  ..##.....##.
  .#..#......#
  #....#.....#
  #.....#....#
  .#.....#..#.
  ..#####.#...
  .........#..
  ..........#.
  ...........#
`)
const CONTRAST = art(`
  ....####....
  ..##..####..
  .#....#####.
  .#....#####.
  #.....######
  #.....######
  #.....######
  #.....######
  .#....#####.
  .#....#####.
  ..##..####..
  ....####....
`)
const DUMBBELL = art(`
  .##......##.
  .##......##.
  ###......###
  ############
  ###......###
  .##......##.
  .##......##.
`)
const FOOTPRINTS = art(`
  .##.........
  ####........
  ####....##..
  ####...####.
  .##....####.
  .......####.
  .##.....##..
  .##.........
  ........##..
  ........##..
`)
const GRADUATION = art(`
  .....##.....
  ...##..##...
  .##......##.
  #..........#
  .##......###
  ..###..###.#
  ..#..##..#.#
  ..#......#.#
  ...######...
`)
const HEART = art(`
  .###....###.
  #ooo#..#ooo#
  #oooo##oooo#
  #oooooooooo#
  #oooooooooo#
  .#oooooooo#.
  ..#oooooo#..
  ...#oooo#...
  ....#oo#....
  .....##.....
`)
const HISTORY = art(`
  ....####....
  #.##....##..
  ##........#.
  ###...#...#.
  ......#....#
  #.....#....#
  #.....###..#
  #..........#
  .#........#.
  .#........#.
  ..##....##..
  ....####....
`)
const LAYOUT_GRID = art(`
  ####.####
  #..#.#..#
  #..#.#..#
  ####.####
  .........
  ####.####
  #..#.#..#
  #..#.#..#
  ####.####
`)
const LIST_TREE = art(`
  ###.########
  .#..........
  .#..........
  .##..#######
  .#..........
  .#..........
  .##..#######
  .#..........
  .#..........
  .##..#######
`)
const MAGNET = art(`
  ####....####
  ####....####
  #..#....#..#
  #..#....#..#
  #..#....#..#
  #..#....#..#
  #...#..#...#
  .#...##...#.
  ..#......#..
  ...######...
`)
const MEDAL = art(`
  ..########..
  ..#..##..#..
  ..#..##..#..
  ...#.##.#...
  ....####....
  ...#....#...
  ..#..##..#..
  .#..#..#..#.
  .#..#..#..#.
  ..#..##..#..
  ...#....#...
  ....####....
`)
const QUESTION = art(`
  ...######...
  ..#......#..
  .#..###...#.
  #..#...#...#
  #......#...#
  #.....#....#
  #....#.....#
  #..........#
  .#...#....#.
  ..#......#..
  .#.######...
  #...........
`)
const MICROSCOPE = art(`
  ...###......
  ...#.#......
  ...#.#......
  ..#####.....
  ...#.#..##..
  ...###....#.
  ....#......#
  ..#####....#
  ..........#.
  .........#..
  ..#######...
  .##########.
`)
const PUZZLE = art(`
  ...####.....
  ...#..#.....
  ####..####..
  #........#..
  #........###
  #..........#
  #..........#
  #........###
  #........#..
  #........#..
  ##########..
`)
const ROCKET = art(`
  .....##.....
  ....#..#....
  ...#....#...
  ...#.##.#...
  ...#.##.#...
  ...#....#...
  ...#....#...
  ..##....##..
  .#.#....#.#.
  .#.######.#.
  .##..##..##.
  .....##.....
`)
const ROTATE_CCW = art(`
  ....#####...
  .#.#.....#..
  .##.......#.
  .###.......#
  ...........#
  #..........#
  #..........#
  .#........#.
  ..#......#..
  ...######...
`)
const SHARE = art(`
  .........###
  ......####.#
  ....##...###
  ..##........
  ###.........
  #.#.........
  ###.........
  ..##........
  ....##...###
  ......####.#
  .........###
`)
const SHIELD_CHECK = art(`
  .##########.
  .#........#.
  .#........#.
  .#......#.#.
  .#.....#..#.
  .#.#..#...#.
  .#..##....#.
  ..#......#..
  ..#......#..
  ...#....#...
  ....#..#....
  .....##.....
`)
const SPLIT = art(`
  ###......###
  ##........##
  #.#......#.#
  ...#....#...
  ....#..#....
  .....##.....
  .....##.....
  .....##.....
  .....##.....
  .....##.....
  .....##.....
`)
const STAR = art(`
  .....##.....
  .....##.....
  ....#oo#....
  ....#oo#....
  #####oo#####
  .#oooooooo#.
  ..#oooooo#..
  ...#oooo#...
  ..#oooooo#..
  ..#oo##oo#..
  .#oo#..#oo#.
  .###....###.
`)
const SUNRISE = art(`
  .....##.....
  .....##.....
  .#........#.
  ..#..##..#..
  ....#..#....
  ...#....#...
  ##.#....#.##
  ............
  ############
  ............
  ...######...
`)
const SWORDS = art(`
  #..........#
  .#........#.
  ..#......#..
  ...#....#...
  ....#..#....
  .....##.....
  .....##.....
  ....#..#....
  ..###..###..
  ..##....##..
  .##......##.
  #..........#
`)
const TIMER = art(`
  ....####....
  .....##..#..
  ...######.#.
  ..#......#..
  .#...#....#.
  .#...#....#.
  .#...###..#.
  .#........#.
  .#........#.
  ..#......#..
  ...######...
`)

// ------------------------------------------------------------------ the names the app imports

export const Activity = icon('activity', ACTIVITY)
export const ArrowLeft = icon('arrow-left', p(arrowLeft))
export const ArrowRight = icon('arrow-right', p(arrowRight))
export const ArrowRightLeft = icon('arrow-right-left', p(sortHorizontal))
export const ArrowUp = icon('arrow-up', p(arrowUp))
export const ArrowUpDown = icon('arrow-up-down', p(sortVertical))
export const Award = icon('award', AWARD)
export const BellRing = icon('bell-ring', p(bellRing))
export const BookMarked = icon('book-marked', BOOK_MARKED)
export const BookOpen = icon('book-open', p(bookOpen))
export const Bot = icon('bot', p(robotFace))
export const Brain = icon('brain', BRAIN)
export const CalendarCheck = icon('calendar-check', CALENDAR_CHECK)
export const Castle = icon('castle', p(castle))
export const Check = icon('check', p(check))
export const CheckCheck = icon('check-check', p(checkDouble))
export const ChevronDown = icon('chevron-down', p(chevronDown))
export const ChevronLeft = icon('chevron-left', p(chevronLeft))
export const ChevronRight = icon('chevron-right', p(chevronRight))
export const Clock = icon('clock', p(clock))
export const Cloud = icon('cloud', p(cloud))
export const CloudOff = icon('cloud-off', CLOUD_OFF)
export const Compass = icon('compass', p(compass))
export const Contrast = icon('contrast', CONTRAST)
export const CornerUpLeft = icon('corner-up-left', p(cornerUpLeft))
export const Crosshair = icon('crosshair', p(gps))
export const Crown = icon('crown', p(crown))
export const Download = icon('download', p(download))
export const Dumbbell = icon('dumbbell', DUMBBELL)
export const Eraser = icon('eraser', p(eraser))
export const ExternalLink = icon('external-link', p(externalLink))
export const Eye = icon('eye', p(eye))
export const EyeOff = icon('eye-off', p(eyeOff))
export const Flag = icon('flag', p(flag))
export const Flame = icon('flame', p(fire))
export const Footprints = icon('footprints', FOOTPRINTS)
export const Gem = icon('gem', p(diamondGem))
export const GraduationCap = icon('graduation-cap', GRADUATION)
export const Grid3x3 = icon('grid-3x3', p(grid3x3))
export const Hand = icon('hand', p(hand))
export const Heart = icon('heart', HEART)
export const History = icon('history', HISTORY)
export const LayoutGrid = icon('layout-grid', LAYOUT_GRID)
export const Lightbulb = icon('lightbulb', p(lightbulb))
export const ListTree = icon('list-tree', LIST_TREE)
export const Loader2 = icon('loader-2', p(loader))
export const Lock = icon('lock', p(lock))
export const LogOut = icon('log-out', p(logout))
export const Magnet = icon('magnet', MAGNET)
export const Mail = icon('mail', p(mail))
export const Map = icon('map', p(map))
export const Medal = icon('medal', MEDAL)
export const MessageCircleQuestion = icon('message-circle-question', QUESTION)
export const Microscope = icon('microscope', MICROSCOPE)
export const Moon = icon('moon', p(moon))
export const Play = icon('play', p(play))
export const Puzzle = icon('puzzle', PUZZLE)
export const RefreshCw = icon('refresh-cw', p(reload))
export const Repeat = icon('repeat', p(repeat))
export const Rocket = icon('rocket', ROCKET)
export const RotateCcw = icon('rotate-ccw', ROTATE_CCW)
export const Search = icon('search', p(search))
export const Settings = icon('settings', p(settingsCog))
export const Shapes = icon('shapes', p(shapes))
export const Share2 = icon('share-2', SHARE)
export const Shield = icon('shield', p(shield))
export const ShieldCheck = icon('shield-check', SHIELD_CHECK)
export const Shuffle = icon('shuffle', p(shuffle))
export const Sparkles = icon('sparkles', p(sparkles))
export const Split = icon('split', SPLIT)
export const Star = icon('star', STAR)
export const Sun = icon('sun', p(sun))
export const Sunrise = icon('sunrise', SUNRISE)
export const Swords = icon('swords', SWORDS)
export const Target = icon('target', p(target))
export const Timer = icon('timer', TIMER)
export const Trash2 = icon('trash-2', p(trash))
export const TrendingUp = icon('trending-up', p(trendingUp))
export const Trophy = icon('trophy', p(trophy))
export const Undo2 = icon('undo-2', p(undo))
export const Upload = icon('upload', p(upload))
export const User = icon('user', p(user))
export const UserRound = icon('user-round', p(user))
export const Volume2 = icon('volume-2', p(volume))
export const X = icon('x', p(close))
export const Zap = icon('zap', p(zap))

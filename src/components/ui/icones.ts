import {
  Archive,
  Building2,
  CalendarDays,
  CalendarClock,
  Check,
  ChevronRight,
  Clock,
  Coins,
  Copy,
  FileText,
  Handshake,
  History,
  House,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Palette,
  Pause,
  Pencil,
  RotateCcw,
  Search,
  Shield,
  Undo2,
  UserPlus,
  UserRound,
  Users,
  UserX,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

/**
 * Os ícones do sistema, por nome.
 *
 * Existe um mapa em vez de cada tela importar do `lucide-react` direto por
 * causa da fronteira servidor→cliente: a `Sidebar` é Server Component e
 * entrega a navegação a `NavLinks`, que é cliente — e componente não
 * atravessa essa fronteira como prop, só dado serializável. O nome atravessa;
 * o componente é resolvido do lado de lá.
 *
 * De quebra, o mapa é o catálogo: um ícone que não está aqui não entra na
 * interface, e é isso que mantém "editar" com o mesmo lápis em toda tela.
 */
export const ICONES = {
  archive: Archive,
  building: Building2,
  calendar: CalendarDays,
  "calendar-clock": CalendarClock,
  check: Check,
  "chevron-right": ChevronRight,
  clock: Clock,
  coins: Coins,
  copy: Copy,
  contract: FileText,
  handshake: Handshake,
  history: History,
  home: House,
  inbox: Inbox,
  key: KeyRound,
  dashboard: LayoutDashboard,
  "log-out": LogOut,
  menu: Menu,
  palette: Palette,
  pause: Pause,
  pencil: Pencil,
  reactivate: RotateCcw,
  refund: Undo2,
  search: Search,
  shield: Shield,
  "user-plus": UserPlus,
  user: UserRound,
  users: Users,
  "user-x": UserX,
  wallet: Wallet,
  x: X,
} as const satisfies Record<string, LucideIcon>;

export type NomeIcone = keyof typeof ICONES;

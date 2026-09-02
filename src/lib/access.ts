export const MODULES = [
  { key: "admin", label: "Admin (Dashboard)" },
  { key: "pharmacy", label: "Pharmacy" },
  { key: "procurement", label: "Procurement" },
  { key: "accountant", label: "Accountant" },
  { key: "order_track", label: "Order Track" },
  { key: "messages", label: "Messages" },
  { key: "public_site", label: "Public Site" },
  { key: "admin_settings", label: "Admin Settings" },
  { key: "vacancy", label: "Vacancy" },
  { key: "service_stock", label: "Service Stock" },
  { key: "pharm_branding", label: "Pharm Branding" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];

const ROLE_DEFAULTS: Record<string, ModuleKey[]> = {
  admin: MODULES.map((m) => m.key) as ModuleKey[],
  pharmacy: ["pharmacy", "messages"],
  inventory: ["procurement"],
  accountant: ["accountant", "messages"],
  order_track: ["order_track"],
  buyer: [],
};

export type AccessProfile = {
  role: string;
  is_director?: boolean | null;
  can_edit_site?: boolean | null;
  access?: string[] | null;
};

export function allowedModules(p: AccessProfile | null | undefined): ModuleKey[] {
  if (!p) return [];
  if (p.is_director) return ["public_site", "admin_settings", "vacancy"];
  if (p.access && p.access.length > 0) return p.access as ModuleKey[];
  const base = [...(ROLE_DEFAULTS[p.role] ?? [])];
  if (p.can_edit_site && !base.includes("public_site")) base.push("public_site");
  return base;
}

export function canAccess(p: AccessProfile | null | undefined, module: ModuleKey): boolean {
  return allowedModules(p).includes(module);
}

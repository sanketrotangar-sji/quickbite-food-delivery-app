import { createFileRoute } from "@tanstack/react-router";
import { Edit3, ImagePlus, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { QuickBiteShell } from "@/components/quickbite-shell";
import { useCreateMenuItem, useDeleteMenuItem, useManagerMenu, useToggleMenuAvailability, useToggleMenuVeg } from "@/hooks/use-manager-menu";
import { useOwnedRestaurant } from "@/hooks/use-restaurant";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/menu")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search["q"] === "string" ? search["q"] : "",
  }),
  head: () => ({ meta: [{ title: "My Menu — QuickBite" }, { name: "description", content: "Manage restaurant menu items and availability in QuickBite." }, { property: "og:title", content: "My Menu — QuickBite" }, { property: "og:description", content: "Manage restaurant menu items and availability in QuickBite." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: MenuPage,
});

const categories = ["All", "Starters", "Main Course", "Breads", "Rice", "Desserts", "Drinks"];

function MenuPage() {
  const { q } = Route.useSearch();
  const { data: restaurant } = useOwnedRestaurant();
  const items = useManagerMenu().data ?? [];
  const toggleAvailability = useToggleMenuAvailability();
  const toggleVeg = useToggleMenuVeg();
  const removeItem = useDeleteMenuItem();
  const createItem = useCreateMenuItem();
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState(q);
  useEffect(() => {
    setSearch(q);
  }, [q]);
  const [drawer, setDrawer] = useState(false);
  const [name, setName] = useState("");
  const [itemCategory, setItemCategory] = useState("Starters");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [available, setAvailable] = useState(true);
  const [veg, setVeg] = useState(false);
  const [imageFile, setImageFile] = useState<File | undefined>();
  const [error, setError] = useState<string | null>(null);
  const restaurantName = restaurant?.name ?? "";
  const filtered = useMemo(() => items.filter((item) => (category === "All" || item.category === category) && item.name.toLowerCase().includes(search.toLowerCase())), [items, category, search]);

  function resetForm() {
    setName("");
    setItemCategory("Starters");
    setDescription("");
    setPrice("");
    setAvailable(true);
    setVeg(false);
    setImageFile(undefined);
    setError(null);
  }

  async function addItem() {
    if (!restaurant) {
      setError("No restaurant assigned.");
      return;
    }
    const parsed = Number(price);
    if (!name.trim() || Number.isNaN(parsed) || parsed < 0) {
      setError("Name and a valid price are required.");
      return;
    }
    setError(null);
    try {
      await createItem.mutateAsync({
        name,
        category: itemCategory,
        description,
        price: parsed,
        isAvailable: available,
        isVeg: veg,
        ...(imageFile ? { imageFile } : {}),
      });
      resetForm();
      setDrawer(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add item.");
    }
  }

  return <QuickBiteShell><div className="mx-auto max-w-7xl">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase text-primary">Menu management</p><h1 className="mt-1 text-3xl font-extrabold">My Menu</h1><p className="mt-1 text-sm text-muted-foreground">Manage your restaurant’s food items and availability.</p></div><Button className="h-11" onClick={() => setDrawer(true)} disabled={!restaurant}><Plus />Add item</Button></div>
    <div className="mt-7 rounded-xl border border-border bg-card shadow-card">
      <div className="flex flex-col gap-4 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between"><div className="relative w-full lg:max-w-xs"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Search your menu" /></div><div className="flex gap-1 overflow-x-auto pb-1">{categories.map((item) => <Button key={item} variant={category === item ? "default" : "ghost"} size="sm" onClick={() => setCategory(item)} className="shrink-0">{item}</Button>)}</div></div>
      <div className="hidden grid-cols-[minmax(260px,2fr)_1fr_120px_140px_100px] gap-4 border-b border-border px-5 py-3 text-[11px] font-bold uppercase text-muted-foreground md:grid"><span>Food</span><span>Category</span><span>Price</span><span>Availability</span><span className="text-right">Actions</span></div>
      <div className="divide-y divide-border">{filtered.map((item) => <div key={item.id} className="grid gap-4 p-4 md:grid-cols-[minmax(260px,2fr)_1fr_120px_140px_100px] md:items-center md:px-5"><div className="flex min-w-0 items-center gap-3">{item.image ? <img src={item.image} alt={item.name} className="size-16 shrink-0 rounded-lg object-cover" /> : <span className="size-16 shrink-0 rounded-lg bg-secondary" />}<div className="min-w-0"><p className="truncate text-sm font-bold">{item.name}</p><p className="truncate text-xs text-muted-foreground">{item.restaurant}</p></div></div><span className="text-sm text-muted-foreground">{item.category || "—"} · <button type="button" className={cn("font-bold", item.veg ? "text-success" : "text-muted-foreground")} onClick={() => void toggleVeg.mutateAsync({ id: item.id, isVeg: !item.veg })}>{item.veg ? "Veg" : "Non-veg"}</button></span><strong className="text-sm">₹{item.price}</strong><div className="flex items-center gap-2"><Switch checked={item.available} onCheckedChange={() => void toggleAvailability.mutateAsync({ id: item.id, available: !item.available })} aria-label={`Set ${item.name} availability`} /><span className={cn("text-xs font-bold", item.available ? "text-success" : "text-destructive")}>{item.available ? "Available" : "Sold out"}</span></div><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" aria-label={`Edit ${item.name}`}><Edit3 /></Button><Button variant="ghost" size="icon" className="text-destructive" aria-label={`Delete ${item.name}`} onClick={() => window.confirm("Delete this menu item? This cannot be undone.") && void removeItem.mutateAsync(item.id)}><Trash2 /></Button></div></div>)}</div>
      {filtered.length === 0 && <div className="p-14 text-center"><p className="font-bold">No menu items found</p><p className="mt-1 text-sm text-muted-foreground">Try a different search or category.</p></div>}
    </div>
    <Sheet open={drawer} onOpenChange={(open) => { setDrawer(open); if (!open) resetForm(); }}><SheetContent className="w-full overflow-y-auto bg-card sm:max-w-lg"><SheetHeader><SheetTitle>Add menu item</SheetTitle><SheetDescription>Add a new dish{restaurantName ? ` to ${restaurantName}` : ""}.</SheetDescription></SheetHeader><div className="mt-6 space-y-5"><label className="grid h-40 w-full cursor-pointer place-items-center rounded-xl border border-dashed border-border bg-secondary text-muted-foreground"><input className="sr-only" type="file" accept="image/*" onChange={(event) => setImageFile(event.target.files?.[0])} /><span className="flex flex-col items-center gap-2 text-sm font-semibold"><ImagePlus />{imageFile ? imageFile.name : "Upload food photo"}</span></label><label className="block text-sm font-bold">Item name<Input className="mt-2" value={name} onChange={(e) => setName(e.target.value)} /></label><label className="block text-sm font-bold">Category<Input className="mt-2" value={itemCategory} onChange={(e) => setItemCategory(e.target.value)} /></label><label className="block text-sm font-bold">Description<Input className="mt-2" value={description} onChange={(e) => setDescription(e.target.value)} /></label><label className="block text-sm font-bold">Price<Input className="mt-2" value={price} onChange={(e) => setPrice(e.target.value)} /></label><label className="flex items-center justify-between rounded-lg border border-border p-4 text-sm font-bold">Veg dish<Switch checked={veg} onCheckedChange={setVeg} /></label><label className="flex items-center justify-between rounded-lg border border-border p-4 text-sm font-bold">Available for orders<Switch checked={available} onCheckedChange={setAvailable} /></label>{error && <p className="text-sm font-semibold text-destructive">{error}</p>}</div><SheetFooter className="mt-7"><Button variant="outline" onClick={() => setDrawer(false)}>Cancel</Button><Button onClick={() => void addItem()} disabled={createItem.isPending}>{createItem.isPending ? "Adding…" : "Add item"}</Button></SheetFooter></SheetContent></Sheet>
  </div></QuickBiteShell>;
}

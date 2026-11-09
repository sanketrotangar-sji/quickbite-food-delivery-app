import { CANONICAL_CATEGORIES, CANONICAL_FOOD_TAGS, normalizeFoodTags } from "@quickbite/domain";
import { getRouteApi } from "@tanstack/react-router";
import { Check, Edit3, ImagePlus, Plus, Search, Sparkles, Tag, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { userFacingMessage } from "@quickbite/api/errors";
import { QuickBiteShell } from "@/components/quickbite-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  useCreateMenuItem,
  useDeleteMenuItem,
  useManagerMenu,
  useSuggestDishTags,
  useToggleMenuAvailability,
  useToggleMenuVeg,
  useUpdateMenuItemReview,
  type VisionAnalysis,
} from "@/hooks/use-manager-menu";
import { useOwnedRestaurant } from "@/hooks/use-restaurant";
import { displayImageUrl, fileToVisionDataUrl } from "@/lib/images";
import type { MenuItem } from "@/lib/quickbite-data";
import { cn } from "@/lib/utils";

const routeApi = getRouteApi("/menu");

const categories = ["All", ...CANONICAL_CATEGORIES];

export function MenuPage() {
  const { q } = routeApi.useSearch();
  const { data: restaurant } = useOwnedRestaurant();
  const items = useManagerMenu().data ?? [];
  const toggleAvailability = useToggleMenuAvailability();
  const toggleVeg = useToggleMenuVeg();
  const removeItem = useDeleteMenuItem();
  const createItem = useCreateMenuItem();
  const updateReview = useUpdateMenuItemReview();
  const suggestTags = useSuggestDishTags();

  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState(q);
  useEffect(() => {
    setSearch(q);
  }, [q]);

  const [drawer, setDrawer] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [name, setName] = useState("");
  const [itemCategory, setItemCategory] = useState("Starters");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [available, setAvailable] = useState(true);
  const [veg, setVeg] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [imageFile, setImageFile] = useState<File | undefined>();
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>("");
  const [aiSuggestion, setAiSuggestion] = useState<VisionAnalysis | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const restaurantName = restaurant?.name ?? "";

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const matchesCat = category === "All" || item.category.toLowerCase() === category.toLowerCase();
        const qLower = search.trim().toLowerCase();
        if (!qLower) return matchesCat;
        const matchesText =
          item.name.toLowerCase().includes(qLower) ||
          item.category.toLowerCase().includes(qLower) ||
          item.tags.some((t) => t.toLowerCase().includes(qLower));
        return matchesCat && matchesText;
      }),
    [items, category, search],
  );

  function resetForm() {
    setEditingItem(null);
    setName("");
    setItemCategory("Starters");
    setDescription("");
    setPrice("");
    setAvailable(true);
    setVeg(false);
    setTags([]);
    setCustomTagInput("");
    setImageFile(undefined);
    setImagePreviewUrl("");
    setAiSuggestion(null);
    setAiError(null);
    setError(null);
  }

  function openAddDrawer() {
    resetForm();
    setDrawer(true);
  }

  function openEditDrawer(item: MenuItem, autoRunAi = false) {
    resetForm();
    setEditingItem(item);
    setName(item.name);
    setItemCategory(item.category || "Main Course");
    setDescription(item.description || "");
    setPrice(String(item.price));
    setAvailable(item.available);
    setVeg(item.veg);
    setTags(normalizeFoodTags(item.tags, { isVeg: item.veg }));
    setImagePreviewUrl(item.image || "");
    setDrawer(true);
    if (autoRunAi && (item.image || item.name)) {
      void runAutoTag({
        file: undefined,
        existingUrl: item.image,
        nameHint: item.name,
        descHint: item.description,
        catHint: item.category,
      });
    }
  }

  async function runAutoTag(opts?: {
    file?: File;
    existingUrl?: string;
    nameHint?: string;
    descHint?: string;
    catHint?: string;
  }) {
    const targetFile = opts?.file ?? imageFile;
    const targetUrl = opts?.existingUrl ?? imagePreviewUrl;
    const nameHint = opts?.nameHint ?? name;
    const descHint = opts?.descHint ?? description;
    const catHint = opts?.catHint ?? itemCategory;

    setAiError(null);
    try {
      let imageDataUrl: string | undefined;
      if (targetFile) {
        imageDataUrl = await fileToVisionDataUrl(targetFile);
      }
      const analysis = await suggestTags.mutateAsync({
        imageDataUrl: imageDataUrl ?? null,
        imageUrl: !imageDataUrl && targetUrl ? displayImageUrl(targetUrl, "full") : null,
        dishNameHint: nameHint,
        descriptionHint: descHint,
        categoryHint: catHint,
      });

      setAiSuggestion(analysis);

      if (!analysis.isFood) {
        setAiError("We couldn't detect a food dish in that photo. Please upload a clearer dish photo or adjust tags manually.");
        return;
      }

      // Pre-populate blank fields or merge suggested tags for owner review
      if (!nameHint.trim() && analysis.dishName) {
        setName(analysis.dishName);
      }
      if (!descHint.trim() && analysis.caption) {
        setDescription(analysis.caption);
      }
      setItemCategory(analysis.category);
      setVeg(analysis.isVeg);
      setTags((prev) =>
        normalizeFoodTags([...prev, ...analysis.tags], {
          isVeg: analysis.isVeg,
          spiceLevel: analysis.spiceLevel,
        }),
      );
    } catch (err) {
      setAiError(userFacingMessage(err, "Could not auto-tag photo right now. You can still edit tags manually."));
    }
  }

  function handleFileChange(file: File | undefined) {
    setImageFile(file);
    setAiError(null);
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setImagePreviewUrl(objectUrl);
      void runAutoTag({ file });
    }
  }

  function toggleTag(tag: string) {
    const slug = tag.toLowerCase().trim();
    setTags((prev) => {
      if (prev.includes(slug)) {
        return prev.filter((t) => t !== slug);
      }
      return normalizeFoodTags([...prev, slug], { isVeg: veg });
    });
  }

  function addCustomTag() {
    const raw = customTagInput.trim();
    if (!raw) return;
    setTags((prev) => normalizeFoodTags([...prev, raw], { isVeg: veg }));
    setCustomTagInput("");
  }

  function handleVegSwitch(nextVeg: boolean) {
    setVeg(nextVeg);
    setTags((prev) => normalizeFoodTags(prev, { isVeg: nextVeg }));
  }

  async function saveItem() {
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
      const cleanTags = normalizeFoodTags(tags, { isVeg: veg });
      if (editingItem) {
        await updateReview.mutateAsync({
          id: editingItem.id,
          name,
          category: itemCategory,
          description,
          price: parsed,
          isVeg: veg,
          tags: cleanTags,
          ...(imageFile ? { imageFile } : {}),
        });
      } else {
        await createItem.mutateAsync({
          name,
          category: itemCategory,
          description,
          price: parsed,
          isAvailable: available,
          isVeg: veg,
          tags: cleanTags,
          ...(imageFile ? { imageFile } : {}),
        });
      }
      resetForm();
      setDrawer(false);
    } catch (err) {
      setError(userFacingMessage(err, "Could not save menu item."));
    }
  }

  const isSaving = createItem.isPending || updateReview.isPending;

  return (
    <QuickBiteShell>
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-primary">Menu management & Vision AI</p>
            <h1 className="mt-1 text-3xl font-extrabold">My Menu</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage dishes, availability, and review AI-suggested food tags from dish photos.
            </p>
          </div>
          <Button className="h-11" onClick={openAddDrawer} disabled={!restaurant}>
            <Plus />
            Add item
          </Button>
        </div>

        <div className="mt-7 rounded-xl border border-border bg-card shadow-card">
          <div className="flex flex-col gap-4 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-xs">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                placeholder="Search dishes or tags (e.g. spicy, dosa)..."
              />
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {categories.map((item) => (
                <Button
                  key={item}
                  variant={category === item ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCategory(item)}
                  className="shrink-0"
                >
                  {item}
                </Button>
              ))}
            </div>
          </div>

          <div className="hidden grid-cols-[minmax(280px,2.2fr)_1fr_100px_140px_140px] gap-4 border-b border-border px-5 py-3 text-[11px] font-bold uppercase text-muted-foreground md:grid">
            <span>Food & AI Tags</span>
            <span>Category</span>
            <span>Price</span>
            <span>Availability</span>
            <span className="text-right">Review & Actions</span>
          </div>

          <div className="divide-y divide-border">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="grid gap-4 p-4 md:grid-cols-[minmax(280px,2.2fr)_1fr_100px_140px_140px] md:items-center md:px-5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {item.image ? (
                    <img
                      src={displayImageUrl(item.image)}
                      alt={item.name}
                      className="size-16 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="size-16 shrink-0 rounded-lg bg-secondary" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{item.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.description || item.restaurant}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      {item.tags.length > 0 ? (
                        item.tags.slice(0, 5).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-foreground"
                          >
                            <Tag className="size-2.5 text-primary" />
                            {tag}
                          </span>
                        ))
                      ) : (
                        <button
                          type="button"
                          onClick={() => openEditDrawer(item, true)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                        >
                          <Sparkles className="size-3" />
                          Auto-tag with AI
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <span className="text-sm text-muted-foreground">
                  {item.category || "—"} ·{" "}
                  <button
                    type="button"
                    className={cn("font-bold", item.veg ? "text-success" : "text-muted-foreground")}
                    onClick={() => void toggleVeg.mutateAsync({ id: item.id, isVeg: !item.veg })}
                  >
                    {item.veg ? "Veg" : "Non-veg"}
                  </button>
                </span>

                <strong className="text-sm">₹{item.price}</strong>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={item.available}
                    onCheckedChange={() =>
                      void toggleAvailability.mutateAsync({ id: item.id, available: !item.available })
                    }
                    aria-label={`Set ${item.name} availability`}
                  />
                  <span className={cn("text-xs font-bold", item.available ? "text-success" : "text-destructive")}>
                    {item.available ? "Available" : "Sold out"}
                  </span>
                </div>

                <div className="flex justify-end gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={() => openEditDrawer(item, item.tags.length === 0)}
                    aria-label={`Review tags for ${item.name}`}
                  >
                    <Sparkles className="size-3.5 text-primary" />
                    Tags
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => openEditDrawer(item, false)}
                    aria-label={`Edit ${item.name}`}
                  >
                    <Edit3 className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive"
                    aria-label={`Delete ${item.name}`}
                    onClick={() =>
                      window.confirm("Delete this menu item? This cannot be undone.") &&
                      void removeItem.mutateAsync(item.id)
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="p-14 text-center">
              <p className="font-bold">No menu items found</p>
              <p className="mt-1 text-sm text-muted-foreground">Try a different search or category.</p>
            </div>
          )}
        </div>

        <Sheet
          open={drawer}
          onOpenChange={(open) => {
            setDrawer(open);
            if (!open) resetForm();
          }}
        >
          <SheetContent className="w-full overflow-y-auto bg-card sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>{editingItem ? "Review AI Tags & Edit Dish" : "Add menu item"}</SheetTitle>
              <SheetDescription>
                {editingItem
                  ? `Review or correct AI-suggested tags, category, and dietary flag for ${editingItem.name}.`
                  : `Upload a food photo to auto-suggest tags and add a dish${restaurantName ? ` to ${restaurantName}` : ""}.`}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-5">
              <div className="space-y-2">
                <label className="relative grid h-44 w-full cursor-pointer place-items-center overflow-hidden rounded-xl border border-dashed border-border bg-secondary text-muted-foreground">
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => handleFileChange(event.target.files?.[0])}
                  />
                  {imagePreviewUrl ? (
                    <img
                      src={imageFile ? imagePreviewUrl : displayImageUrl(imagePreviewUrl, "full")}
                      alt={name || "Dish preview"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex flex-col items-center gap-2 text-sm font-semibold">
                      <ImagePlus />
                      Upload food photo (auto-tags with Vision AI)
                    </span>
                  )}
                </label>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {imageFile
                      ? `Selected: ${imageFile.name}`
                      : imagePreviewUrl
                        ? "Using current dish photo"
                        : "Upload a JPG, PNG, or WebP photo"}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={suggestTags.isPending || (!imageFile && !imagePreviewUrl && !name.trim())}
                    onClick={() => void runAutoTag()}
                    className="gap-1.5 text-xs font-bold"
                  >
                    <Sparkles className="size-3.5 text-primary" />
                    {suggestTags.isPending ? "Analyzing photo…" : "Auto-tag with AI"}
                  </Button>
                </div>
              </div>

              {/* AI Auto-Tag Review & Correction Panel */}
              <div className="rounded-xl border border-border bg-secondary/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="size-4 text-primary" />
                    <span className="text-xs font-extrabold uppercase tracking-wide text-primary">
                      AI Auto-Tag Review & Correction
                    </span>
                  </div>
                  {aiSuggestion && (
                    <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                      {Math.round(aiSuggestion.confidence * 100)}% match · {aiSuggestion.cuisine}
                    </span>
                  )}
                </div>

                {aiError && (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
                    {aiError}
                  </p>
                )}

                {aiSuggestion && aiSuggestion.isFood && (
                  <div className="rounded-lg border border-border bg-card p-3 text-xs space-y-1.5">
                    <p className="font-bold text-foreground">
                      Detected: <span className="text-primary">{aiSuggestion.dishName}</span> ({aiSuggestion.category} ·{" "}
                      {aiSuggestion.isVeg ? "Veg" : "Non-veg"} · {aiSuggestion.spiceLevel} spice)
                    </p>
                    <p className="text-muted-foreground">{aiSuggestion.caption}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs font-bold text-foreground">
                    Active Dish Tags (click to remove or toggle before saving)
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {tags.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        No tags selected yet. Click "Auto-tag with AI" or pick from suggestions below.
                      </span>
                    ) : (
                      tags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground shadow-xs"
                        >
                          <Check className="size-3" />
                          {tag}
                          <X className="ml-0.5 size-3 opacity-80" />
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase text-muted-foreground">
                    Quick-add canonical tags
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {CANONICAL_FOOD_TAGS.filter((t) => !tags.includes(t))
                      .slice(0, 14)
                      .map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:border-primary hover:text-foreground"
                        >
                          + {tag}
                        </button>
                      ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Input
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomTag();
                      }
                    }}
                    placeholder="Add custom tag (e.g. crispy, goan)…"
                    className="h-8 text-xs"
                  />
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={addCustomTag}>
                    Add tag
                  </Button>
                </div>
              </div>

              <label className="block text-sm font-bold">
                Item name
                <Input className="mt-2" value={name} onChange={(e) => setName(e.target.value)} />
              </label>

              <label className="block text-sm font-bold">
                Category
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {CANONICAL_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setItemCategory(cat)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors",
                        itemCategory === cat
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-secondary text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </label>

              <label className="block text-sm font-bold">
                Description
                <Input className="mt-2" value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>

              <label className="block text-sm font-bold">
                Price (₹)
                <Input className="mt-2" type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
              </label>

              <label className="flex items-center justify-between rounded-lg border border-border p-4 text-sm font-bold">
                <span>Veg dish</span>
                <Switch checked={veg} onCheckedChange={handleVegSwitch} />
              </label>

              {!editingItem && (
                <label className="flex items-center justify-between rounded-lg border border-border p-4 text-sm font-bold">
                  <span>Available for orders</span>
                  <Switch checked={available} onCheckedChange={setAvailable} />
                </label>
              )}

              {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
            </div>

            <SheetFooter className="mt-7">
              <Button variant="outline" onClick={() => setDrawer(false)}>
                Cancel
              </Button>
              <Button onClick={() => void saveItem()} disabled={isSaving}>
                {isSaving ? "Saving…" : editingItem ? "Accept & Save Tags" : "Accept & Add Item"}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </QuickBiteShell>
  );
}

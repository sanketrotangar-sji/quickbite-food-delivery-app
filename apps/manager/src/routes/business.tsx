import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2, MapPin, Plus, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { createBranch, inviteManager, listInvites, listMembers, revokeManager } from "@/api/partners";
import { QuickBiteShell } from "@/components/quickbite-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useOwnedRestaurant, useUpdateRestaurant } from "@/hooks/use-restaurant";
import type { Restaurant } from "@/api/restaurants";

type Panel = "profile" | "invite" | "team" | "add" | null;

export const Route = createFileRoute("/business")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Business — QuickBite" },
      { name: "description", content: "Manage restaurants and the managers who run them." },
      { property: "og:title", content: "Business — QuickBite" },
      { property: "og:description", content: "Manage restaurants and the managers who run them." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BusinessPage,
});

function BusinessPage() {
  const navigate = useNavigate();
  const { profile, session, loading } = useAuth();
  const { restaurants } = useOwnedRestaurant();
  const isOwner = profile?.role === "restaurant_owner";
  const owned = restaurants.filter((row) => row.owner_id === session?.user.id);
  const [panel, setPanel] = useState<Panel>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = owned.find((row) => row.id === activeId) ?? null;

  useEffect(() => {
    if (loading) return;
    if (!isOwner) void navigate({ to: "/" });
  }, [isOwner, loading, navigate]);

  function open(next: Exclude<Panel, "add" | null>, restaurantId: string) {
    setActiveId(restaurantId);
    setPanel(next);
  }

  if (loading || !isOwner) return null;

  return (
    <QuickBiteShell>
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-bold uppercase text-primary">Business</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold">Your restaurants</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a restaurant or a branch, then invite the manager who runs that kitchen.
            </p>
          </div>
          <Button onClick={() => setPanel("add")}>
            <Plus /> Add restaurant
          </Button>
        </div>

        {owned.length === 0 ? (
          <div className="mt-7 rounded-xl border border-border bg-card p-10 text-center">
            <p className="font-bold">No restaurants yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add the first restaurant. You can run it yourself or invite a manager.
            </p>
          </div>
        ) : (
          <ul className="mt-7 space-y-4">
            {owned.map((row) => (
              <li key={row.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-xl font-extrabold">
                      {row.name}
                      {row.branch_name ? ` · ${row.branch_name}` : ""}
                    </h2>
                    <p className="mt-1 flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{row.address}</span>
                    </p>
                  </div>
                  <span
                    className={
                      row.is_open
                        ? "text-xs font-bold text-success"
                        : "text-xs font-bold text-muted-foreground"
                    }
                  >
                    {row.is_open ? "Open" : "Closed"}
                  </span>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <Button variant="outline" className="justify-start bg-card" onClick={() => open("profile", row.id)}>
                    <Building2 /> Edit profile
                  </Button>
                  <Button variant="outline" className="justify-start bg-card" onClick={() => open("invite", row.id)}>
                    <UserPlus /> Invite manager
                  </Button>
                  <Button variant="outline" className="justify-start bg-card" onClick={() => open("team", row.id)}>
                    <Users /> Manage team
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <ProfileSheet
          restaurant={panel === "profile" ? active : null}
          onClose={() => setPanel(null)}
        />
        <AddRestaurantSheet open={panel === "add"} onClose={() => setPanel(null)} />
        {active ? (
          <TeamSheets
            key={active.id}
            restaurantId={active.id}
            panel={panel === "invite" || panel === "team" ? panel : null}
            setPanel={setPanel}
          />
        ) : null}
      </div>
    </QuickBiteShell>
  );
}

function ProfileSheet({ restaurant, onClose }: { restaurant: Restaurant | null; onClose: () => void }) {
  const updateRestaurant = useUpdateRestaurant();
  const [name, setName] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurant) return;
    setName(restaurant.name);
    setCuisine(restaurant.cuisine ?? "");
    setAddress(restaurant.address);
    setPhone(restaurant.phone ?? "");
    setDescription(restaurant.description ?? "");
    setError(null);
  }, [restaurant]);

  async function saveProfile() {
    if (!restaurant) return;
    if (!name.trim() || !address.trim()) {
      setError("Name and address are required.");
      return;
    }
    setError(null);
    try {
      await updateRestaurant.mutateAsync({
        id: restaurant.id,
        patch: {
          name: name.trim(),
          address: address.trim(),
          cuisine: cuisine.trim() || null,
          phone: phone.trim() || null,
          description: description.trim() || null,
        },
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    }
  }

  return (
    <Sheet open={Boolean(restaurant)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto bg-card sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit profile</SheetTitle>
          <SheetDescription>Update how this restaurant appears to customers.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-3">
          <Field label="Name" value={name} onChange={setName} />
          <Field label="Cuisine" value={cuisine} onChange={setCuisine} />
          <Field label="Address" value={address} onChange={setAddress} />
          <Field label="Phone" value={phone} onChange={setPhone} />
          <label className="block text-sm font-bold">
            Description
            <Textarea className="mt-2" value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          {error ? <p className="text-sm font-semibold text-destructive">{error}</p> : null}
        </div>
        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void saveProfile()} disabled={updateRestaurant.isPending}>
            {updateRestaurant.isPending ? "Saving…" : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function AddRestaurantSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [branchLabel, setBranchLabel] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const addRestaurant = useMutation({
    mutationFn: () =>
      createBranch({
        name,
        address,
        ...(branchLabel.trim() ? { branchName: branchLabel.trim() } : {}),
      }),
    onSuccess: () => {
      setName("");
      setBranchLabel("");
      setAddress("");
      setMessage(null);
      void queryClient.invalidateQueries({ queryKey: ["my-restaurants"] });
      onClose();
    },
    onError: (err: Error) => setMessage(err.message),
  });

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setMessage(null);
          onClose();
        }
      }}
    >
      <SheetContent className="w-full overflow-y-auto bg-card sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add a restaurant</SheetTitle>
          <SheetDescription>
            Use a new name for a different restaurant, or the same name with a branch label for another location.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-3">
          <Field label="Restaurant name" value={name} onChange={setName} />
          <Field label="Branch (optional)" value={branchLabel} onChange={setBranchLabel} />
          <Field label="Address" value={address} onChange={setAddress} />
          {message ? <p className="text-sm font-semibold text-destructive">{message}</p> : null}
        </div>
        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => void addRestaurant.mutate()}
            disabled={addRestaurant.isPending || !name.trim() || !address.trim()}
          >
            {addRestaurant.isPending ? "Creating…" : "Create restaurant"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function TeamSheets({
  restaurantId,
  panel,
  setPanel,
}: {
  restaurantId: string;
  panel: "invite" | "team" | null;
  setPanel: (panel: Panel) => void;
}) {
  const queryClient = useQueryClient();
  const members = useQuery({
    queryKey: ["restaurant-members", restaurantId],
    queryFn: () => listMembers(restaurantId),
    enabled: panel === "team",
  });
  const invites = useQuery({
    queryKey: ["manager-invites", restaurantId],
    queryFn: () => listInvites(restaurantId),
    enabled: panel === "invite",
  });
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const invite = useMutation({
    mutationFn: () => inviteManager(restaurantId, email),
    onSuccess: () => {
      setEmail("");
      setMessage("Invite sent. They must sign in with that email.");
      void queryClient.invalidateQueries({ queryKey: ["manager-invites", restaurantId] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const revoke = useMutation({
    mutationFn: (userId: string) => revokeManager(restaurantId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["restaurant-members", restaurantId] });
    },
  });

  return (
    <>
      <Sheet open={panel === "invite"} onOpenChange={(open) => setPanel(open ? "invite" : null)}>
        <SheetContent className="w-full overflow-y-auto bg-card sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Invite manager</SheetTitle>
            <SheetDescription>They operate this restaurant from the dashboard. They cannot order from it.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            <Field label="Email" value={email} onChange={setEmail} />
            {(invites.data ?? []).map((row) => (
              <p key={row.id} className="text-sm text-muted-foreground">
                Pending: {row.email}
              </p>
            ))}
            {message ? <p className="text-sm font-semibold text-muted-foreground">{message}</p> : null}
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setPanel(null)}>
              Cancel
            </Button>
            <Button onClick={() => void invite.mutate()} disabled={invite.isPending || !email.trim()}>
              {invite.isPending ? "Sending…" : "Send invite"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={panel === "team"} onOpenChange={(open) => setPanel(open ? "team" : null)}>
        <SheetContent className="w-full overflow-y-auto bg-card sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Manage team</SheetTitle>
            <SheetDescription>Remove a manager from this restaurant.</SheetDescription>
          </SheetHeader>
          <ul className="mt-6 space-y-3">
            {(members.data ?? []).length === 0 ? (
              <li className="text-sm text-muted-foreground">No managers yet.</li>
            ) : (
              (members.data ?? []).map((row) => (
                <li key={row.user_id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {row.profiles?.full_name?.trim() || row.profiles?.email || row.user_id}
                    </span>
                    {row.profiles?.full_name ? (
                      <span className="block truncate text-xs text-muted-foreground">{row.profiles.email}</span>
                    ) : null}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => void revoke.mutate(row.user_id)}>
                    Remove
                  </Button>
                </li>
              ))
            )}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-bold">
      {label}
      <Input className="mt-2" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

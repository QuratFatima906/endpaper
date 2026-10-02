"use client";

import { useEffect, useState } from "react";
import { UsernameField, useUsernameCheck } from "@/components/account-username";
import { AppHeader, BackLink, Page, SavedHint, TextArea, TextField } from "@/components/ui";
import { now, patch } from "@/lib/repo";
import { useSession } from "@/lib/session";
import type { Profile } from "@/lib/types";

export default function EditProfile() {
  const { profile } = useSession();
  return profile ? <Form profile={profile} /> : null; // RequireAuth guarantees it
}

function Form({ profile }: { profile: Profile }) {
  const [username, setUsername] = useState(profile.username);
  const [name, setName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio);
  const [savedAt, setSavedAt] = useState<string>();
  const check = useUsernameCheck(username, profile.id, profile.username);

  // Autosave: the username once it's confirmed free, name and bio after a pause.
  useEffect(() => {
    if (check.state !== "ok") return;
    void patch<Profile>("profiles", profile.id, { username }).then(() => setSavedAt(now()));
  }, [check.state, username, profile.id]);

  useEffect(() => {
    if (name === profile.display_name && bio === profile.bio) return;
    const t = setTimeout(() => void patch<Profile>("profiles", profile.id, { display_name: name, bio }).then(() => setSavedAt(now())), 400);
    return () => clearTimeout(t);
  }, [name, bio, profile.id, profile.display_name, profile.bio]);

  return (
    <Page>
      <div className="hidden md:block">
        <AppHeader />
      </div>
      <div className="mx-auto max-w-[640px]">
        <div className="pt-[calc(env(safe-area-inset-top)+50px)] md:pt-[40px]">
          <BackLink href="/settings">Settings</BackLink>
        </div>
        <div className="mt-[26px] flex items-baseline justify-between gap-4 md:mt-4">
          <h1 className="font-serif text-[32px] leading-[1.1] md:text-[40px]">Name and bio</h1>
          <SavedHint at={savedAt} />
        </div>
        <div className="mt-7 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-muted" aria-hidden="true">
              Username
            </p>
            <UsernameField value={username} onChange={setUsername} check={check} />
            <p className="-mt-2 text-[13px] text-muted">Changing it changes the address of your public page. Old links stop working.</p>
          </div>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} />
          <TextArea label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} minRows={3} maxLength={400} />
        </div>
      </div>
    </Page>
  );
}

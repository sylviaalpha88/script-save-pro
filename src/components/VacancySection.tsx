import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Vacancy = { id: string; pharmacy_id: string | null; title: string; description: string };

export function VacancySection() {
  const [list, setList] = useState<Vacancy[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("vacancies").select("id, pharmacy_id, title, description").eq("is_open", true)
      .then(({ data }) => setList((data as Vacancy[]) ?? []));
  }, []);

  return (
    <section id="vacancy" className="scroll-mt-20">
      <h2 className="text-3xl font-bold tracking-tight">Vacancy</h2>
      {list.length === 0 ? (
        <p className="mt-4 text-muted-foreground">There are no open vacancies at the moment. Please check back later.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {list.map(v => (
            <div key={v.id} className="rounded-lg border p-5">
              <h3 className="text-xl font-semibold">{v.title}</h3>
              <p className="mt-2 text-muted-foreground whitespace-pre-wrap">{v.description}</p>
              <Button className="mt-4" variant={openId === v.id ? "outline" : "default"}
                onClick={() => setOpenId(openId === v.id ? null : v.id)}>
                {openId === v.id ? "Close form" : "Apply for this job"}
              </Button>
              {openId === v.id && <ApplyForm vacancy={v} onDone={() => setOpenId(null)} />}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ApplyForm({ vacancy, onDone }: { vacancy: Vacancy; onDone: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [letter, setLetter] = useState<File | null>(null);
  const [cv, setCv] = useState<File | null>(null);
  const [certs, setCerts] = useState<FileList | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File, kind: string) => {
    const path = `${vacancy.id}/${crypto.randomUUID()}-${kind}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error } = await supabase.storage.from("applications").upload(path, file);
    if (error) throw new Error(error.message);
    return path;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!letter || !cv) { toast.error("Attach your application letter and CV"); return; }
    setBusy(true);
    try {
      const letterPath = await upload(letter, "letter");
      const cvPath = await upload(cv, "cv");
      const certPaths: string[] = [];
      for (const f of Array.from(certs ?? [])) certPaths.push(await upload(f, "cert"));
      const { error } = await supabase.from("vacancy_applications").insert({
        vacancy_id: vacancy.id,
        pharmacy_id: vacancy.pharmacy_id,
        applicant_name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        letter_path: letterPath,
        cv_path: cvPath,
        certificate_paths: certPaths,
      });
      if (error) throw new Error(error.message);
      toast.success("Application submitted");
      onDone();
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="mt-5 grid sm:grid-cols-2 gap-4 border-t pt-5">
      <div><Label>Your name</Label><Input value={name} onChange={e => setName(e.target.value)} required maxLength={120} /></div>
      <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={255} /></div>
      <div><Label>Phone number</Label><Input value={phone} onChange={e => setPhone(e.target.value)} maxLength={20} /></div>
      <div><Label>Application letter</Label><Input type="file" accept=".pdf,.doc,.docx" onChange={e => setLetter(e.target.files?.[0] ?? null)} required /></div>
      <div><Label>CV</Label><Input type="file" accept=".pdf,.doc,.docx" onChange={e => setCv(e.target.files?.[0] ?? null)} required /></div>
      <div><Label>Certificates (you can pick several)</Label><Input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={e => setCerts(e.target.files)} /></div>
      <div className="sm:col-span-2"><Button type="submit" className="w-full" disabled={busy}>{busy ? "Submitting…" : "Submit application"}</Button></div>
    </form>
  );
}

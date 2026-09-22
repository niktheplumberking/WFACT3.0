# WFACT SOP 3 — Post-Launch, Automation & Team Operations

Everything after launch, the automation layer, and how each role works.

*Last updated: July 23, 2026 (verified against the live 2.0 factory). Carried into 3.0 as reference law for the same business process.*

## 1. Stage 9 — Content Bank + the Publisher

Every launched project becomes a showcase carousel, art-directed with a fresh concept each time, filed and queued. Publishing happens from the Cockpit's Content room through the Publisher: Instagram (full carousel), Facebook Pages (full carousel), and LinkedIn company pages (hook slide plus caption-as-post), one button per connected account, each guarded by the client's portfolio permission on file, an approved caption, and a human click with a 3-second undo. Account tokens live in an owner-only vault. TikTok, YouTube Shorts, and X are documented connector slots, not yet built.

## 2. Stage 10 — Post-mortem (internal)

The factory analyzes its own project: time per stage and why, design self-critique, client-experience friction, what to never repeat. Lessons enter the permanent ledger, with the owner's veto. The same mistake cannot happen twice. Bank-worthy invented mechanisms are nominated for reuse.

## 3. The Care Plan, the recurring-revenue engine

Monthly, per care client, the session opens with the audit-first law, no content work before hunting four diseases in Search Console: cannibalization, decay, striking-distance queries (positions 8 to 20, the cheapest wins in SEO), and cluster gaps. The keyword map is organized into topical clusters (one pillar per money topic, orphan articles are banned).

**Care Basic**: audit, fixes, and report, plus GBP Care for local clients (review replies drafted in the client's voice, Google posts, profile completeness).

**Care Growth** adds quarterly content briefs, backlink outreach drafts (earned links only, listicle targeting: get the client into the "best X in Y" lists that already rank), and a quarterly sourced statistics page, the linkable asset journalists actually cite. Data is pulled, never invented, every action lands in the care log with a commit or draft to point at.

## 4. The automation layer, what runs itself

**The mail engine**: mailboxes polled every five minutes, inbound mail classified (lead, booking, signed, reply, other), first replies personally written by Amir per the personalization law, chasers day 2 and day 5, bookings and signatures detected from Calendly and PandaDoc notifications arriving at the owner's events-only mailbox.

**Branded email**: everything client-facing wears the entity's house design with the CEO's photo signature.

**Notifications**: every event that needs a human reaches email, phone push, and Telegram, per-person and per-category configurable, with quiet hours and digest mode.

**The Call Brief**: written by Amir one hour before every booked meeting, once per meeting, into the Inbox.

**Invoices**: Amir drafts at money gates (deposit, milestone, final, care), the owner's approve mints a Stripe payment link (once the key exists) and emails invoice plus link.

**The summonable desk**: the Advance button dispatches a real headless build session that obeys every law and stops at human gates.

**Factory governance**: partner changes to the factory itself arrive as pull requests needing two approvals, each PR becomes a plain-English Factory Update card in the Inbox, approve equals a real GitHub review, the owner pushes freely.

**The autonomy switchboard**: every checkpoint starts at notify-and-wait, auto-pass is earned per checkpoint after three consecutive zero-correction projects, Launch and Money never flip, by design, the global kill switch (usable by any admin) freezes mail, chasers, and runs instantly.

## 5. The human moments, the complete list

The sales call, the client's signature and the owner's countersignature, the deposit confirmation, direction approvals (Stage 2 spec, Stage 4 homepage), the client's written direction lock plus milestone payment, the owner's real-device QA script, launch, the final payment confirmation, every Approval Inbox item until its switch earns auto-pass, social publishing, tax and legal judgment (Amir drafts, the accountant owns compliance), the lessons veto.

## 6. The tools map, one line each

**Cockpit**, the control room (phone-installable): Today's Focus, Pipeline, Inbox, Runs, Money, SEO, Content, Health, Calendar, Team and Settings. **Amir**, the chief of staff. **Factory repo**, the process brain on GitHub, protected main, partner PRs need two approvals. **Supabase**, the database behind the Cockpit and every Owner's Key. **Vercel**, Cockpit plus previews only. **Hostinger**, where client sites live. **Namecheap Private Email**, the mailboxes. **Calendly and PandaDoc**, booking and e-signing, both watched automatically. **Telegram bot**, third notification channel. **Higgsfield**, in-house image and video generation. **claude-seo**, the SEO engine. **scroll-film-studio**, the Film Site engine. **senior-arabic-rtl-dev**, Arabic and RTL law for GCC clients.

## 7. Quickstart — Owner

Your day starts on your phone: Cockpit, Today's Focus, everything open in one feed, new leads included, star up to three things (or accept Amir's pick) and the day is won. A buzz deep-links to the exact card, approve, edit-then-approve, or reject with a note, that is 80 percent of your job in the machine. Call briefs arrive an hour before meetings. Proposals present from any device with live-editable pricing. Anything for the desk goes through Requests or Amir. Weekly two minutes: Health's cost tiles and the Switchboard. Scared? The kill switch is always safe. Never: approve by memory, let anyone bypass a gate, or ship anything without its entity's identity.

## 8. Quickstart — Admin

You run operations when the owner is selling, full access including Money, owner-only: Team, Switchboard, audit log, token vault. Morning: clear your Inbox tabs (Approvals, Requests, Factory Updates). Watch the lead column for stuck deals, a personal reply beats a template chase. Sanity-check names, numbers, and entity on every document. Everything for the desk goes through Requests, the single pipe. You can hit the kill switch. Escalate money, legal wording, scope changes, and anything touching Launch.

## 9. Quickstart — Project Manager

You see your assigned clients only, money is hidden. Your board is the Pipeline room: keep the baton moving and honest. Stages stall on missing content, not missing code, chase logos, copy, and access the day they are first mentioned. Answer client replies inside your approval scope, queue the rest. You can request gate runs, you cannot pass gates that belong to the owner or the client. Arabic-market projects: flag the country at intake, the RTL law drives spec and QA automatically. At launch: confirm the Closing Report landed, the client can use their Owner's Key, and the first care month is booked.

## 10. When something breaks

Same rule for humans as machines: stop, do not improvise past a broken gate. State plainly what broke, what was tried, and the options. The kill switch exists for "I don't know what it's doing" moments. One-time desk setup per computer: `npm install` in the factory folder plus the `.env` file with the database keys, keys are never pasted into chats or committed.

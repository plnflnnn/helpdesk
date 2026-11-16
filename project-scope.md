# AI-Powered Ticket Management System

## Problem

We receive hundreds of support emails daily. Our agents manually read, classify, and respond to each ticket — which is slow and leads to impersonal, canned responses.

## Solution

Build a ticket management system that uses AI to automatically classify, summarize, and draft replies to support tickets — delivering faster, more personalized responses to students while freeing up agents for complex issues.

In v1, **AI suggests and agents approve**: no reply is sent to a student without an agent reviewing it.

## Success Criteria

- Median time to first response under 2 hours during business hours
- At least 70% of AI category suggestions left unchanged by agents
- At least 50% of AI reply drafts sent with only minor edits

## Features (v1)

### Email intake
- Support address forwards to SendGrid Inbound Parse, which posts each email to a webhook
- New email creates a ticket; replies are threaded onto the existing ticket using `Message-ID` / `In-Reply-To` / `References` headers, with a ticket ID in the reply-to address (e.g. `support+T1234@...`) as a fallback
- Attachments stored in object storage and shown on the ticket (max 10 MB per file)
- Noise filtering: emails with `Auto-Submitted` or `Precedence: bulk` headers, `noreply` senders, and high spam scores go to a **Filtered** list that admins can review — never silently deleted

### Outbound email
- Replies sent via SendGrid from the support domain (SPF, DKIM, DMARC configured)
- Replies are signed by the sending agent

### Tickets
- Ticket list with filtering (status, category, priority, assignee, "My tickets", "Unassigned") and sorting
- Search by keyword (subject and body) and by student email
- Ticket detail view with:
  - Full conversation thread (student and agent messages in order)
  - Internal notes visible only to agents, styled differently from replies
  - AI summary
  - AI-drafted reply that the agent can edit and send
  - Student's previous tickets
  - Activity history (audit log)

### Routing
- All tickets start in a shared, unassigned queue
- Agents can **claim** a ticket; admins can **assign** a ticket to any agent
- Claimed tickets show "Being handled by X" and warn other agents before they reply

### AI features
- **Classification:** suggests category and priority for each new ticket
- **Summary:** short summary of the conversation, refreshed when the student replies
- **Suggested reply:** draft based on the ticket and the knowledge base, regenerated when the student replies
- If no relevant knowledge base article is found, the AI does not guess: the ticket is flagged **"Needs human: no KB match"** and only a short acknowledgment is drafted
- Agents can override category and priority; the original AI values are kept for measuring accuracy
- Every sent reply records whether it was the AI draft unchanged, edited, or written manually

### Knowledge base
- Articles stored in the app: title, Markdown body, category, published/draft status
- Admins create, edit, and delete articles
- Embeddings are generated automatically when an article is saved
- The 3–5 most relevant published articles are included when drafting a reply

### Dashboard
- Ticket counts by status and category
- Unassigned ticket count
- Median time to first response
- AI draft acceptance rate (unchanged / edited / rewritten)

### Notifications
- In-app only: badge for new tickets and for student replies on tickets you've claimed

### User management (admin only)
- Create agents; agent receives an invite link by email and sets their own password
- Deactivate agents: all their sessions end immediately and their claimed tickets return to the unassigned queue
- Manage knowledge base articles

## Ticket Statuses

| Status | Meaning |
|---|---|
| **Open** | New ticket or student replied. Needs action. |
| **Pending** | Agent replied; waiting on the student. Not counted as backlog. |
| **Resolved** | Issue fixed. A student reply reopens it to Open. |
| **Closed** | Final. Set automatically 7 days after Resolved. A student reply creates a new ticket linked to the old one. |

## Ticket Priorities

- Low
- Normal (default)
- High (default for Refund Requests)

## Ticket Categories

One category per ticket:

- General Question
- Technical Question
- Refund Request
- Other (fallback when none of the above fit)

## Students

- Identified by email address only; created automatically from their first email
- Interact only by email — no student portal

## User Roles

- **Admin**: The first admin is created at deployment by a seed script using `ADMIN_EMAIL` / `ADMIN_PASSWORD` environment variables. Multiple admins are allowed. Can do everything an agent can, plus manage agents and knowledge base articles.
- **Agent**: Created by an admin. Can view, claim, and manage tickets.

Authentication uses email and password with database sessions.

## Non-Functional Requirements

- **Volume:** designed for up to 1,000 tickets per day
- **Reliability:** incoming email is saved before any AI processing. AI jobs retry 3 times with increasing delays, then mark the ticket "AI unavailable"; agents can always reply manually
- **AI cost:** 3 model calls per new ticket (classification, summary, reply draft); student replies regenerate only the summary and draft. A monthly spending cap and alert are set in the Anthropic console
- **Privacy:**
  - Attachments are never sent to the AI
  - Signatures and quoted reply history are removed before text is sent to the AI
  - Tickets are kept for 2 years, then deleted
  - Anthropic and SendGrid are documented as data processors if GDPR applies
- **Language:** English interface. The AI replies in the student's language when it is clear

## Out of Scope for v1

- Auto-sending AI replies without agent approval
- Student portal
- Automatic ticket assignment (round-robin, by category)
- SLAs and business-hours tracking
- Integration with the course platform (enrollment or purchase lookups)
- Syncing the knowledge base from external tools such as Notion or a help center
- Learning from past tickets
- Google SSO and 2FA
- Email notifications to agents
- Multi-language interface

## Possible v2 Ideas

- Auto-send for General Questions when AI confidence is high and the draft edit rate has stayed low (Refund Requests always require a human)
- Automatic assignment by category or workload
- Course platform integration to show enrollment and purchase data on tickets
- Google SSO and 2FA
- Email notifications for agents

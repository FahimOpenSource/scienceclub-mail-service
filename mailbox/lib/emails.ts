export interface Email {
  id: string
  sender: string
  senderEmail: string
  subject: string
  preview: string
  body: string
  date: string
  read: boolean
  starred?: boolean
  folder: "inbox" | "spam"
}

export const allMailData: Email[] = [
  {
    id: "1",
    sender: "Sarah Johnson",
    senderEmail: "sarah.j@company.com",
    subject: "Q2 Marketing Report",
    preview: "Hi team, please find attached the Q2 marketing performance report. Key highlights include...",
    body: `Hi team,

Please find attached the Q2 marketing performance report. Key highlights include a 24% increase in qualified leads, a 12% reduction in cost-per-acquisition, and strong growth from our partnership channel.

I'd like to discuss the next steps for Q3 planning during our Thursday sync. Let me know if you have any questions before then.

Best,
Sarah`,
    date: "10:30 AM",
    read: false,
    starred: true,
    folder: "inbox",
  },
  {
    id: "2",
    sender: "GitHub",
    senderEmail: "noreply@github.com",
    subject: "[vercel/next.js] Pull request merged",
    preview: "Your pull request #4521 has been successfully merged into the main branch...",
    body: `Your pull request #4521 has been successfully merged into the main branch.

Title: Improve hydration performance for Server Components
Author: you
Reviewers: 3 approving reviews

The changes are now part of the main branch and will be included in the next release.`,
    date: "9:15 AM",
    read: true,
    folder: "inbox",
  },
  {
    id: "3",
    sender: "David Chen",
    senderEmail: "d.chen@startup.io",
    subject: "Meeting Tomorrow",
    preview: "Hey! Just wanted to confirm our meeting tomorrow at 2pm. Let me know if that still works...",
    body: `Hey!

Just wanted to confirm our meeting tomorrow at 2pm. Let me know if that still works for you, or if we need to reschedule.

I've prepared a short deck covering the integration timeline and the open technical questions from last week.

Talk soon,
David`,
    date: "Yesterday",
    read: false,
    folder: "inbox",
  },
  {
    id: "4",
    sender: "Vercel",
    senderEmail: "notifications@vercel.com",
    subject: "Deployment successful",
    preview: "Your deployment to production has completed successfully. View your site at...",
    body: `Your deployment to production has completed successfully.

Project: science-club-mail
Environment: Production
Duration: 38s

You can view your site at https://your-site.vercel.app`,
    date: "Yesterday",
    read: true,
    folder: "inbox",
  },
  {
    id: "5",
    sender: "Newsletter",
    senderEmail: "weekly@techdigest.com",
    subject: "This Week in Tech",
    preview: "Top stories: AI advancements, new framework releases, and industry updates...",
    body: `Top stories this week:

1. New advancements in on-device AI inference make small models surprisingly capable.
2. A major framework released a long-awaited compiler that ships less JavaScript by default.
3. Industry updates and quiet acquisitions to keep an eye on.

Read the full digest on our site.`,
    date: "May 3",
    read: true,
    folder: "inbox",
  },
]

export const spamData: Email[] = [
  {
    id: "s1",
    sender: "Winner Notification",
    senderEmail: "prize@lottery-win.xyz",
    subject: "You have WON $1,000,000!!!",
    preview: "Congratulations! You have been selected as the winner of our grand prize lottery...",
    body: `Congratulations!

You have been selected as the winner of our grand prize lottery. To claim your prize, please reply with your full bank details and a copy of your ID.

This is obviously a scam. Do not respond.`,
    date: "11:45 AM",
    read: false,
    folder: "spam",
  },
  {
    id: "s2",
    sender: "Account Security",
    senderEmail: "security@bank-verify.net",
    subject: "URGENT: Verify your account now",
    preview: "Your account will be suspended unless you verify your identity immediately...",
    body: `Your account will be suspended unless you verify your identity immediately by clicking the link below.

This message is a phishing attempt. Real banks do not ask for credentials over email.`,
    date: "8:20 AM",
    read: false,
    folder: "spam",
  },
  {
    id: "s3",
    sender: "Dr. Smith",
    senderEmail: "offers@health-deals.biz",
    subject: "Amazing weight loss secret revealed",
    preview: "Doctors hate this one simple trick that melts fat overnight...",
    body: `Doctors hate this one simple trick that melts fat overnight. Order now for a limited-time discount.

This is spam. Ignore.`,
    date: "Yesterday",
    read: true,
    folder: "spam",
  },
]

export function getEmailById(id: string): Email | undefined {
  return [...allMailData, ...spamData].find((e) => e.id === id)
}

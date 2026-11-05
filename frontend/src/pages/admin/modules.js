import {
  LayoutDashboard, Flame, Newspaper, CalendarDays, Handshake, Wallet, Users,
  MessageSquare, HeartPulse, UserRoundCog, ClipboardList, Settings, CircleHelp,
  Images, ChartNoAxesColumn, FileText, Mail, PiggyBank, BarChart3,
} from 'lucide-react';

/**
 * The single description of every admin section: who may see it, which table
 * backs it, which fields it edits, and the guide shown to the operator.
 *
 * Keeping this in one place means the navigation, the role rules and the
 * editors cannot drift apart.
 */
export const SECTIONS = {
  dashboard: {
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['super_admin', 'admin', 'editor', 'finance', 'case_worker', 'staff'],
    guide: {
      title: 'Your starting point',
      steps: [
        'The cards at the top summarise the whole foundation at a glance.',
        'Donation activity shows verified income over the last 90 days.',
        'Recent donations lists the newest verified gifts.',
        'The enquiries card counts messages still waiting for a reply.',
        'Use Quick access to jump straight to the area you need.',
      ],
      note: 'Only figures your role is allowed to see are counted here, so a zero may simply mean "not visible to you".',
    },
  },

  programmes: {
    label: 'Programmes',
    table: 'programmes',
    icon: Flame,
    roles: ['super_admin', 'admin', 'editor'],
    fields: ['title', 'category', 'description', 'body', 'goal_amount', 'status', 'image_path'],
    guide: {
      title: 'Programmes are what donors can choose to fund',
      steps: [
        'Create a programme, give it a clear title and a short description.',
        'Add a cover image so donors see what their money supports.',
        'Set a fundraising goal if you want a progress bar shown publicly.',
        'Keep it as a draft until it is ready, then set the status to published.',
      ],
      note: 'The amount raised is calculated automatically from verified donations. You cannot edit it by hand, and that is deliberate.',
    },
  },

  news: {
    label: 'News & stories',
    table: 'news',
    icon: Newspaper,
    roles: ['super_admin', 'admin', 'editor'],
    fields: ['title', 'slug', 'excerpt', 'body', 'cover_image_path', 'status', 'published_at'],
    guide: {
      title: 'Share updates and stories',
      steps: [
        'Write a short introduction in the summary field; it appears in listings.',
        'Add a cover image for the story card.',
        'Set the publish date so the story appears in the right order.',
        'Publish only when the wording is final.',
      ],
      note: 'Never include a child’s name, photograph or medical detail without documented guardian consent.',
    },
  },

  events: {
    label: 'Events',
    table: 'events',
    icon: CalendarDays,
    roles: ['super_admin', 'admin', 'editor'],
    fields: ['title', 'description', 'venue', 'starts_at', 'ends_at', 'image_path', 'status'],
    guide: {
      title: 'Publish upcoming activities',
      steps: [
        'Enter the venue and the start and end times.',
        'Add an image so the event stands out on the public site.',
        'Set the status to published to make it visible.',
      ],
      note: 'Past events stay listed unless you archive them.',
    },
  },

  partners: {
    label: 'Partners',
    table: 'partners',
    icon: Handshake,
    roles: ['super_admin', 'admin', 'editor'],
    fields: ['name', 'website', 'description', 'status', 'logo_path'],
    guide: {
      title: 'Organisations you work with',
      steps: [
        'Add the organisation name and a link to their website.',
        'Upload their logo so the partners page looks complete.',
        'Publish once the partner has agreed to be listed.',
      ],
    },
  },

  faqs: {
    label: 'FAQs',
    table: 'faqs',
    icon: CircleHelp,
    roles: ['super_admin', 'admin', 'editor'],
    fields: ['question', 'answer', 'sort_order', 'status'],
    guide: {
      title: 'Answer common questions',
      steps: [
        'Write the question exactly as a visitor would ask it.',
        'Give a plain, direct answer.',
        'Use the display order to put the most important questions first.',
      ],
    },
  },

  gallery: {
    label: 'Gallery',
    table: 'gallery_items',
    icon: Images,
    roles: ['super_admin', 'admin', 'editor'],
    fields: ['title', 'description', 'image_path', 'alt_text', 'consent_reference', 'consent_verified', 'status'],
    guide: {
      title: 'Approved photographs only',
      steps: [
        'Upload the photograph and describe it for screen readers.',
        'Record the consent reference for anyone identifiable in the image.',
        'Tick consent verified only when that consent is on file.',
        'Publish. Photographs without verified consent are not shown publicly.',
      ],
      note: 'This is a safeguarding control, not a formality. Do not tick consent verified without a signed record.',
    },
  },

  impact_reports: {
    label: 'Impact reports',
    table: 'impact_reports',
    icon: ChartNoAxesColumn,
    roles: ['super_admin', 'admin', 'editor'],
    fields: ['title', 'reporting_period', 'summary', 'cover_image_path', 'report_path', 'published_at', 'status'],
    guide: {
      title: 'Show how funds were used',
      steps: [
        'Name the reporting period clearly, for example "January to June 2026".',
        'Summarise the results and the spending.',
        'Add a cover image and, if you have one, the report file path.',
      ],
    },
  },

  site_pages: {
    label: 'Policy pages',
    table: 'site_pages',
    icon: FileText,
    roles: ['super_admin', 'admin', 'editor'],
    fields: ['slug', 'title', 'body', 'status'],
    guide: {
      title: 'Privacy, safeguarding and terms',
      steps: [
        'The URL slug must match the page you are editing, such as privacy or safeguarding.',
        'Write the policy text in the body field.',
        'Publish to make it live on the website.',
      ],
      note: 'Changing a slug that already exists publicly will break the link to that page.',
    },
  },

  donations: {
    label: 'Donations',
    table: 'donations',
    icon: Wallet,
    roles: ['super_admin', 'admin', 'finance'],
    guide: {
      title: 'Every verified donation, in one ledger',
      steps: [
        'Filter by status to focus on pending, paid or refunded gifts.',
        'Search by donor name, email or payment reference.',
        'Export the filtered list to a spreadsheet with the export button.',
        'Refunds are initiated from here and are restricted to administrators.',
      ],
      note: 'Only donations marked paid count toward the foundation totals. Pending online payments are not treated as money received.',
    },
  },

  allocations: {
    label: 'Allocations',
    icon: PiggyBank,
    roles: ['super_admin', 'admin', 'finance'],
    guide: {
      title: 'Decide where received money goes',
      steps: [
        'The balance at the top is verified income minus everything already allocated.',
        'Choose a destination: a programme, a project, a child case, or general support.',
        'Enter the amount and a short note explaining the decision.',
        'The amount is deducted from the balance immediately.',
      ],
      note: 'No payment happens here. The money has already been received; you are only recording where it was directed. Allocating more than the balance is refused.',
    },
  },

  reports: {
    label: 'Reports',
    icon: BarChart3,
    roles: ['super_admin', 'admin', 'finance'],
    guide: {
      title: 'Money in, money directed, money left',
      steps: [
        'Choose a date range to look at a month, a quarter or the whole year.',
        'Received is the total of verified paid donations in that period.',
        'Allocated is what has been directed to programmes, projects and child cases.',
        'Unallocated is what remains available to assign.',
      ],
      note: 'Received and allocated are kept separate on purpose. Combining them would make the public fundraising totals wrong.',
    },
  },

  beneficiaries: {
    label: 'Child cases',
    icon: HeartPulse,
    roles: ['super_admin', 'admin', 'case_worker'],
    guide: {
      title: 'Confidential casework, recorded properly',
      steps: [
        'Register a case with a reference code rather than the child’s full name.',
        'Record the guardian consent you have obtained before anything else.',
        'Add the support needed, the target amount and any medical detail.',
        'Assign a named worker and record each follow-up in the case history.',
        'Upload private documents to the case file. These are never public.',
      ],
      note: 'A case can only appear on the public site when guardian consent to publish is recorded AND you deliberately turn on public visibility. Both are off by default.',
    },
  },

  staff_profiles: {
    label: 'Staff accounts',
    table: 'staff_profiles',
    icon: UserRoundCog,
    roles: ['super_admin', 'admin'],
    guide: {
      title: 'Who can sign in, and what they can do',
      steps: [
        'Create an account with the person’s real name and work email.',
        'Choose the smallest role that lets them do their job.',
        'They receive a temporary password and must change it at first sign-in.',
        'Set an account inactive to remove access without deleting the record.',
      ],
      note: 'Only a super administrator can change another super administrator’s role. This is enforced in the database.',
    },
  },

  inbox: {
    label: 'Enquiries',
    icon: MessageSquare,
    roles: ['super_admin', 'admin', 'staff', 'editor'],
    guide: {
      title: 'Messages, volunteers and partnership enquiries',
      steps: [
        'New items appear at the top with a New marker.',
        'Open an item to read it, then mark it in review or approved.',
        'Use the reply address shown on the item to respond directly.',
      ],
      note: 'Applicants receive an automatic confirmation email when they submit.',
    },
  },

  newsletter: {
    label: 'Newsletter',
    table: 'newsletter_subscribers',
    icon: Mail,
    roles: ['super_admin', 'admin', 'editor'],
    guide: {
      title: 'People who asked to hear from you',
      steps: [
        'This list is built from the newsletter form on the public site.',
        'Unsubscribe someone immediately if they ask you to.',
        'Never share this list outside the foundation.',
      ],
      note: 'This list contains personal data. Handle it under the foundation privacy policy.',
    },
  },

  audit_logs: {
    label: 'Audit trail',
    table: 'audit_logs',
    icon: ClipboardList,
    roles: ['super_admin', 'admin'],
    guide: {
      title: 'A record of who did what',
      steps: [
        'Every significant action is written here automatically.',
        'Use it to check when something changed and who changed it.',
        'This record cannot be edited from the dashboard.',
      ],
    },
  },

  settings: {
    label: 'Foundation settings',
    table: 'foundation_settings',
    icon: Settings,
    roles: ['super_admin', 'admin'],
    guide: {
      title: 'The foundation’s public identity',
      steps: [
        'Set the official name, contact email and phone numbers.',
        'Upload the logo. It appears in the website header, footer and here.',
        'Add social media links so visitors can follow the work.',
        'Save, then reload the public site to confirm the change.',
      ],
      note: 'The official name is Ugoekloh Foundations. Keep it consistent everywhere.',
    },
  },

  email_settings: {
    label: 'Email delivery',
    icon: Mail,
    roles: ['super_admin', 'admin'],
    guide: {
      title: 'Automatic confirmation emails',
      steps: [
        'Choose the provider that sends the foundation’s emails.',
        'Turn sending on only when the provider is correctly configured.',
        'Send a test email to yourself before relying on it.',
      ],
      note: 'If sending is off, submissions are still saved in the dashboard. Only the confirmation email is skipped.',
    },
  },
};

export const ROLE_MODULES = {
  super_admin: Object.keys(SECTIONS),
  admin: Object.keys(SECTIONS),
  editor: ['dashboard', 'programmes', 'news', 'events', 'partners', 'faqs', 'gallery', 'impact_reports', 'site_pages', 'inbox', 'newsletter'],
  finance: ['dashboard', 'donations', 'allocations', 'reports'],
  case_worker: ['dashboard', 'beneficiaries'],
  staff: ['dashboard', 'inbox'],
};

export const ROLE_LABELS = {
  super_admin: 'Super administrator',
  admin: 'Administrator',
  editor: 'Editor',
  finance: 'Finance officer',
  case_worker: 'Case worker',
  staff: 'Staff',
};

/** Navigation entries for a role, in display order. */
export function sectionsForRole(role) {
  return (ROLE_MODULES[role] || []).map((key) => [key, SECTIONS[key]]).filter(([, section]) => section);
}

/** Field label overrides where the database name is not clear enough. */
export const FIELD_LABELS = {
  title: 'Title',
  description: 'Short description',
  body: 'Full content',
  category: 'Category',
  goal_amount: 'Fundraising goal (GHS)',
  status: 'Publishing status',
  image_path: 'Featured image',
  cover_image_path: 'Cover image',
  logo_path: 'Logo',
  slug: 'Page URL slug',
  excerpt: 'Short introduction',
  venue: 'Venue',
  starts_at: 'Event starts',
  ends_at: 'Event ends',
  published_at: 'Publish date',
  name: 'Name',
  website: 'Website',
  question: 'Question',
  answer: 'Answer',
  sort_order: 'Display order',
  alt_text: 'Image description (for screen readers)',
  consent_reference: 'Guardian consent reference',
  consent_verified: 'Guardian consent verified',
  reporting_period: 'Reporting period',
  summary: 'Summary',
  report_path: 'Report file path',
  foundation_name: 'Foundation name',
  contact_email: 'Public contact email',
  contact_phone: 'General contact number',
  call_line: 'Dedicated call line number',
  address: 'Foundation address',
  tagline: 'Tagline',
  facebook_url: 'Facebook page',
  instagram_url: 'Instagram profile',
  x_url: 'X (Twitter) profile',
  linkedin_url: 'LinkedIn page',
  about_summary: 'About the foundation',
};

export const MULTILINE_FIELDS = [
  'description', 'body', 'excerpt', 'answer', 'summary', 'public_story',
  'support_need', 'medical_needs', 'rehabilitation_needs', 'about_summary', 'note',
];

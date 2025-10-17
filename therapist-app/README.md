# Rejuvenators Therapist Portal

Mobile-first web application for therapists to manage their bookings, availability, and earnings.

## Features

- **Dashboard**: Real-time view of today's bookings and earnings
- **Schedule**: Calendar view of all bookings
- **Profile Management**: Update personal information and preferences
- **Availability**: Manage working hours and time off
- **Service Area**: Define service coverage with polygon drawing
- **Invoice Submission**: Submit weekly invoices and parking receipts
- **Earnings Tracking**: View current and historical earnings

## Tech Stack

- React 18 + TypeScript
- Vite (build tool)
- Ant Design (UI components)
- Supabase (backend + auth)
- React Router (navigation)
- Day.js (date handling)

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key
- `VITE_GOOGLE_MAPS_API_KEY`: Google Maps API key (for service area polygon)

### 3. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 4. Build for Production

```bash
npm run build
```

## Project Structure

```
therapist-app/
├── src/
│   ├── components/     # Reusable React components
│   │   └── AppLayout.tsx
│   ├── pages/          # Page components
│   │   ├── Dashboard.tsx
│   │   ├── Login.tsx
│   │   ├── Schedule.tsx
│   │   ├── Profile.tsx
│   │   ├── Availability.tsx
│   │   ├── ServiceArea.tsx
│   │   ├── Invoices.tsx
│   │   └── Earnings.tsx
│   ├── services/       # API clients
│   │   └── supabaseClient.ts
│   ├── types/          # TypeScript types
│   │   └── index.ts
│   ├── utils/          # Utility functions
│   ├── App.tsx         # Main app component with routing
│   └── main.tsx        # Entry point
├── .env.example        # Environment variables template
└── package.json
```

## Authentication

The app uses Supabase Auth with email/password. Only users with a therapist profile can access the portal.

## Deployment

### Netlify

1. Connect your GitHub repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Add environment variables in Netlify dashboard
5. Deploy!

Suggested subdomain: `therapist.rmmbook.netlify.app`

## Development Phases

- ✅ **Phase 1**: Core infrastructure + navigation (COMPLETED)
- 🔄 **Phase 2**: Dashboard + profile management (IN PROGRESS)
- ⏳ **Phase 3**: Schedule + booking detail with status buttons
- ⏳ **Phase 4**: Payments & invoicing
- ⏳ **Phase 5**: Testing & deployment

## Related Projects

- **Admin Panel**: `../admin` - Full admin management system
- **Booking Platform**: `../booking` - Customer-facing booking website
- **Netlify Functions**: `../netlify/functions` - Backend API functions

## License

Private - Rejuvenators Mobile Massage

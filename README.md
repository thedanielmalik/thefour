# THE FOUR — FIND YOUR FOUR

Campaign platform for The Four: No One Fights Alone, proposed by WAWO Brand House.

## Experience

FIND → CREATE → SHARE → WATCH

A Four is a four-person squad that can create a campaign visual, invite the other members, complete a shared Four Room, choose a cinema and continue into the approved ticketing flow.

## Current stack

- Next.js App Router + static export
- React + TypeScript
- Supabase Postgres + Storage
- Supabase Edge Function API
- Browser-native image processing
- Native share / WhatsApp sharing
- Persistent Four Rooms
- Campaign event tracking
- First-500 reward qualification engine
- Protected campaign dashboard
- GitHub Pages deployment workflow

## Production dependencies

The campaign still needs approved movie artwork/talent assets, final privacy/consent language, cinema/showtime inventory, ticketing integration and final reward/redemption rules before public launch.

## Security

Never put the Supabase service-role key in the browser or repository. The public campaign uses the Supabase anonymous key only for authenticating requests to the Edge Function; privileged database access remains server-side.

## Deployment

GitHub Pages builds use /thefour as the site base path. Vercel and other hosts can run with the default root path.

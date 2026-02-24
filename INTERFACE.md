# GitHub Pages Interface Preview

## Desktop View

The web interface features a clean, modern design with the following sections:

### Header
- **Bold title**: "GitHub Activity Summary"
- **Subtitle**: "Track and visualize GitHub activity"
- **Color scheme**: Blue gradient background (#0969da to #0550ae)

### Default User Section

#### Summary Statistics Cards (4-column grid)
```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│  Total Events   │   Active Days   │ Avg Events/Day  │  Repositories   │
│      127        │       18        │      4.1        │       8         │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

#### Activity Charts (2-column grid)
```
┌─────────────────────────────┬─────────────────────────────┐
│  Activity by Type           │  Top Repositories           │
│  ▰▰▰▰▰▰▰▰▰▰ commit (67)    │  ▰▰▰▰▰▰▰▰▰▰ mgifford/... 45 │
│  ▰▰▰▰▰▰ pull request (28)  │  ▰▰▰▰▰▰▰ w3c/wcag2ict 32   │
│  ▰▰▰▰▰ issue comment (32)  │  ▰▰▰▰ private-repos 50     │
└─────────────────────────────┴─────────────────────────────┘
```

#### Daily Timeline
```
┌────────────────────────────────────────────────────────────┐
│ Monday 2024-02-19                                          │
│ 12 events: 8 commit, 2 pull request, 2 issue comment     │
│ Repositories: mgifford/gh-summary, w3c/wcag2ict          │
├────────────────────────────────────────────────────────────┤
│ Tuesday 2024-02-20                                         │
│ 8 events: 5 commit, 3 issue comment                       │
│ Repositories: mgifford/gh-summary                         │
└────────────────────────────────────────────────────────────┘
```

### Query Other Users Section

#### Input Form
```
┌────────────────────────────────────────────────────────────┐
│ Query Another User                                         │
│                                                            │
│ Enter any GitHub username to view their public activity.  │
│ Data is fetched in real-time and not stored.             │
│                                                            │
│ ┌──────────────────────────────────┬──────────────┐      │
│ │ Enter GitHub username            │ View Activity│      │
│ └──────────────────────────────────┴──────────────┘      │
└────────────────────────────────────────────────────────────┘
```

#### Query Results (shown after submitting)
- Loading spinner while fetching
- Same summary statistics and charts as default user
- Data appears in real-time
- No data stored

### Footer
```
┌────────────────────────────────────────────────────────────┐
│ Powered by gh-summary | GitHub API                         │
│                                                            │
│ Privacy: Only public data is displayed for queried users. │
│ Cached data for the default user may include aggregated   │
│ statistics from private repositories.                      │
└────────────────────────────────────────────────────────────┘
```

## Mobile View

On mobile devices (< 768px):
- Statistics cards stack vertically (1 column)
- Charts stack vertically (1 column)
- Timeline date and content stack vertically
- Form input and button stack vertically
- Optimized font sizes and spacing

## Color Scheme

### Primary Colors
- **Primary Blue**: #0969da (buttons, accents, headings)
- **Secondary Green**: #2da44e (chart gradients)
- **Dark Blue**: #0550ae (hover states)

### Background Colors
- **Page Background**: #f6f8fa (light gray)
- **Card Background**: #ffffff (white)
- **Surface**: #f6f8fa (light gray for cards)

### Text Colors
- **Primary Text**: #24292f (dark gray)
- **Secondary Text**: #57606a (medium gray)
- **Error**: #cf222e (red)

### Border Colors
- **Border**: #d0d7de (light gray)

## Interactions

### Hover Effects
- Statistics cards: Subtle lift with shadow
- Buttons: Darker shade on hover
- Timeline items: Background color change

### Loading States
- Animated spinner with rotating border
- Loading message below spinner
- Appears when querying users

### Error States
- Red background with error message
- Clear error text
- Shown when API fails or user not found

## Responsive Breakpoints

- **Desktop**: > 768px (full layout)
- **Tablet**: 480px - 768px (adjusted grid)
- **Mobile**: < 480px (single column)

## Accessibility Features

- Semantic HTML5 elements
- ARIA labels where needed
- Keyboard navigation support
- High contrast ratios (WCAG AA compliant)
- Focus indicators on interactive elements
- Screen reader friendly

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance

- Lightweight CSS (no frameworks)
- Vanilla JavaScript (no dependencies)
- Cached data served from static files
- Client-side rendering for queries
- Progressive enhancement

## Example Live URL

Once deployed to GitHub Pages:
```
https://mgifford.github.io/gh-summary/
```

Or with custom domain:
```
https://activity.example.com/
```

## Screenshots

To see the actual interface:
1. Deploy to GitHub Pages (see SETUP.md)
2. Visit your GitHub Pages URL
3. The interface will load with cached data

## Customization

Developers can customize:
- Colors in `styles.css` (:root variables)
- Layout in `styles.css` (grid sections)
- Chart rendering in `app.js`
- Data display format in `app.js`

All without changing core functionality.

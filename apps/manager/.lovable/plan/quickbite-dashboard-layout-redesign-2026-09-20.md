# QuickBite Dashboard Layout Redesign

## Goal
Reorganize the dashboard into a clear operational command center that helps a restaurant manager understand demand, spot delays, and act quickly during peak service.

## Dashboard hierarchy

1. **Remove the static greeting**
   - Remove the manager name and greeting from the dashboard body.
   - Keep the restaurant name and a compact date/service-status heading on the page.
   - Put “Good morning, Sanket” only inside the dismissible welcome card, alongside yesterday’s orders, revenue/rating summary, and the good-luck message.
   - Show the welcome card as a calm corner overlay without covering live work.

2. **Create a stable metrics row**
   - Move the four key metrics into one responsive row above live orders instead of stacking them in a narrow right column.
   - Prioritize actionable measures: orders today, revenue, active kitchen load, and average preparation time.
   - Add clear trend/context labels and prevent metric cards from stretching to unrelated heights.

3. **Make Live Orders the operational focus**
   - Give Live Orders the widest area and organize cards into clear status lanes: New, Preparing, and Ready for pickup.
   - Show status counts in each lane and surface overdue or approaching-late orders first.
   - Keep one valid next action per order, while allowing cards to grow naturally with their contents instead of using fixed heights.
   - On smaller screens, stack lanes by urgency with Incoming first and retain large touch actions.

4. **Add a peak-service attention panel**
   - Add a compact “Needs attention” panel beside Live Orders with only operational exceptions:
     - unaccepted orders and longest wait,
     - preparation delays,
     - riders waiting or arriving soon,
     - unavailable menu items,
     - current kitchen load/estimated prep time.
   - Use severity and concise actions rather than decorative widgets or additional charts.

5. **Make Menu Snapshot useful**
   - Replace the current mixed item sample with an explicit unavailable-items list.
   - Show each unavailable item’s photo, name, category, and an inline “Mark available” control.
   - Keep the available/unavailable totals and a clear link to manage the full menu.

6. **Rebalance supporting information**
   - Keep performance secondary and compact, with revenue pace, order volume, average order value, and a restrained hourly trend.
   - Reduce Quick Actions to a small utility area so it never competes with live orders.
   - Use consistent section spacing, card padding, alignment, and responsive grid tracks across desktop, tablet, and mobile.

## Interaction and responsive behavior
- Accepting or marking an order ready will update its lane, status counts, metrics, and attention panel immediately.
- The order detail drawer remains available without leaving the dashboard.
- Desktop uses a wide operations area with a compact attention rail; tablet reflows into two columns; mobile becomes a single urgency-first feed.
- Cards use content-driven height, minimum width constraints, and balanced grid tracks to avoid clipping, awkward blank space, or forced fixed sizing.

## Technical details
- Refactor the dashboard composition into focused sections while preserving the existing order workflow and menu data.
- Update the order card layout for natural height and status-lane use.
- Use existing QuickBite semantic colors, Inter typography, Lucide icons, and current food photography only.
- Verify at desktop and mobile widths, including card alignment, overflow, welcome-card placement, and order transitions.

// Page headings take focus after in-app navigation (not on first load) so keyboard and
// screen-reader users land on the new content.
let enabled = false;
export const enableNavigationFocus = () => {
  enabled = true;
};
export const shouldFocusHeading = () => enabled;

// Values React Native accepts, from the AccessibilityRole and Role types in
// react-native/Libraries/Components/View/ViewAccessibility. The two props take
// different vocabularies: accessibilityRole uses React Native's own names
// ("header", "image"), role uses ARIA names ("heading", "img").

export const ACCESSIBILITY_ROLES = new Set([
  'none', 'button', 'dropdownlist', 'togglebutton', 'link', 'search', 'image', 'keyboardkey', 'text',
  'adjustable', 'imagebutton', 'header', 'summary', 'alert', 'checkbox', 'combobox', 'menu', 'menubar',
  'menuitem', 'progressbar', 'radio', 'radiogroup', 'scrollbar', 'spinbutton', 'switch', 'tab', 'tabbar',
  'tablist', 'timer', 'list', 'toolbar', 'grid', 'pager', 'scrollview', 'horizontalscrollview', 'viewgroup',
  'webview', 'drawerlayout', 'slidingdrawer', 'iconmenu',
]);

export const ARIA_ROLES = new Set([
  'alert', 'alertdialog', 'application', 'article', 'banner', 'button', 'cell', 'checkbox', 'columnheader',
  'combobox', 'complementary', 'contentinfo', 'definition', 'dialog', 'directory', 'document', 'feed',
  'figure', 'form', 'grid', 'group', 'heading', 'img', 'link', 'list', 'listitem', 'log', 'main', 'marquee',
  'math', 'menu', 'menubar', 'menuitem', 'meter', 'navigation', 'none', 'note', 'option', 'presentation',
  'progressbar', 'radio', 'radiogroup', 'region', 'row', 'rowgroup', 'rowheader', 'scrollbar', 'searchbox',
  'separator', 'slider', 'spinbutton', 'status', 'summary', 'switch', 'tab', 'table', 'tablist', 'tabpanel',
  'term', 'timer', 'toolbar', 'tooltip', 'tree', 'treegrid', 'treeitem',
]);

/** Standard action names; any other action is custom and needs a label. */
export const STANDARD_ACTIONS = new Set(['activate', 'increment', 'decrement', 'longpress', 'magicTap', 'escape']);

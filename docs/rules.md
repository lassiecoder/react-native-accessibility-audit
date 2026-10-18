# Rules

Every rule reads the props React Native puts on host elements (`View`, `Text`, `Image`), so it works the same whether you write `role` / `aria-*` props or `accessibilityRole` / `accessibilityState`. "Pressable" below means anything that responds to presses: `Pressable`, every `Touchable*`, `Button`, and `Text` with `onPress`.

Elements hidden from screen readers (`aria-hidden`, `accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"`, `display: 'none'`) and everything inside them are skipped by all rules.

- [interactive-role-required](#interactive-role-required)
- [interactive-label-required](#interactive-label-required)
- [input-label-required](#input-label-required)
- [interactive-accessible-required](#interactive-accessible-required)
- [image-label-required](#image-label-required)
- [no-nested-interactive](#no-nested-interactive)
- [state-required](#state-required)
- [adjustable-role-required](#adjustable-role-required)
- [link-role-misused](#link-role-misused)
- [no-empty-text](#no-empty-text)
- [touch-target-size](#touch-target-size)
- [text-contrast](#text-contrast)

---

## interactive-role-required

**Default: error.** Replaces `pressable-role-required` and `link-role-required`.

Screen readers announce a control's role ("button", "link", "checkbox") so people know what pressing it will do. A pressable without a role is announced as plain content, or not at all on some platforms.

```tsx
// ✗ No role
<Pressable onPress={save}><Text>Save</Text></Pressable>
<Text onPress={openTerms}>Terms</Text>

// ✗ A content role on a control
<Pressable onPress={save} accessibilityRole="header"><Text>Save</Text></Pressable>

// ✓
<Pressable onPress={save} accessibilityRole="button"><Text>Save</Text></Pressable>
<Text onPress={openTerms} role="link">Terms</Text>
<Button title="Save" onPress={save} />  // Button sets role="button" itself
```

`none`, `presentation`, `text`, `header`, `heading`, `image`, `img` and `summary` count as non-interactive roles. `Switch` is exempt because it gets its role from the platform.

## interactive-label-required

**Default: error.** Replaces `pressable-label-required`.

A control needs a name for the screen reader to read. If it has visible text, that text is the name. Icon-only buttons need an explicit label.

```tsx
// ✗ Nothing to read
<Pressable onPress={close} accessibilityRole="button">
  <CloseIcon />
</Pressable>
<Switch value={wifi} onValueChange={setWifi} />

// ✓
<Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close">
  <CloseIcon />
</Pressable>
<Pressable onPress={close} accessibilityRole="button">
  <Image source={closeIcon} accessibilityLabel="Close" />
</Pressable>
<Switch value={wifi} onValueChange={setWifi} accessibilityLabel="Wi-Fi" />
```

The name comes from `aria-label` or `accessibilityLabel`, or else the text and labels of the element's children. Whitespace-only labels don't count, and neither does text hidden from screen readers.

`aria-labelledby` / `accessibilityLabelledBy` don't count: React Native supports them only on Android, so on iOS the element would have no name. Use them together with `accessibilityLabel` if you want both.

## input-label-required

**Default: error.**

Text inputs and sliders need a label that says what they're for. A visible `Text` next to the field isn't connected to it, so the screen reader doesn't read it when the field is focused. A placeholder isn't a label either: it disappears as soon as someone types.

```tsx
// ✗ Visible label, but not connected
<Text>Email</Text>
<TextInput />

// ✗ Placeholder only
<TextInput placeholder="Email" />

// ✗ Android only
<Text nativeID="email-label">Email</Text>
<TextInput accessibilityLabelledBy="email-label" />

// ✓
<Text>Email</Text>
<TextInput accessibilityLabel="Email" placeholder="you@example.com" />
<Slider minimumValue={0} maximumValue={100} accessibilityLabel="Volume" />
```

The label comes from `accessibilityLabel` or `aria-label`. `accessibilityLabelledBy` / `aria-labelledby` work only on Android, so on their own they're reported. Combine them with `accessibilityLabel`.

Checks `TextInput` (single and multi-line) and `Slider` from `@react-native-community/slider`. `Switch` is checked by [interactive-label-required](#interactive-label-required).

## interactive-accessible-required

**Default: error.** Replaces `pressable-accessible-required`.

`accessible={false}` on a control removes it from the screen reader's focus order. People using VoiceOver or TalkBack can't reach it.

```tsx
// ✗
<TouchableOpacity onPress={like} accessible={false} accessibilityRole="button">
  <HeartIcon />
</TouchableOpacity>

// ✓
<TouchableOpacity onPress={like} accessibilityRole="button" accessibilityLabel="Like">
  <HeartIcon />
</TouchableOpacity>
```

Inline `Text` links are exempt, since nested text is grouped with its surrounding text.

## image-label-required

**Default: error.**

An image either carries information, and needs a description, or it's decorative and should be hidden. This rule makes you choose.

```tsx
// ✗ Neither labelled nor marked decorative
<Image source={chart} />

// ✓ Informative
<Image source={chart} accessibilityLabel="Sales grew 20% in March" />
<Image source={avatar} alt="Profile photo of Sam" />

// ✓ Decorative
<Image source={divider} alt="" />
<Image source={divider} aria-hidden />
<Image source={divider} importantForAccessibility="no" />
```

Images inside a pressable or another `accessible` container are skipped: the container's label is what gets read, and [interactive-label-required](#interactive-label-required) checks it.

## no-nested-interactive

**Default: error.**

Screen readers usually focus only the outer control, so a control inside another one can't be reached. It also makes it unclear which action a tap triggers.

```tsx
// ✗ The inner button can't be focused
<Pressable onPress={openItem} accessibilityRole="button">
  <Text>Order #1234</Text>
  <Pressable onPress={deleteItem} accessibilityRole="button">
    <Text>Delete</Text>
  </Pressable>
</Pressable>

// ✓ Siblings
<View>
  <Pressable onPress={openItem} accessibilityRole="button"><Text>Order #1234</Text></Pressable>
  <Pressable onPress={deleteItem} accessibilityRole="button"><Text>Delete</Text></Pressable>
</View>
```

The inner control is the one reported. If you need several actions on one row, consider `accessibilityActions` on the outer element.

## state-required

**Default: error.** Replaces `checked-state-required` and `adjustable-value-required`.

A checkbox that doesn't say whether it's checked, or a slider that doesn't say its value, is useless to someone who can't see it.

```tsx
// ✗
<Pressable onPress={toggle} role="checkbox"><Text>Remember me</Text></Pressable>
<View accessible accessibilityRole="adjustable" accessibilityLabel="Volume" />

// ✓
<Pressable onPress={toggle} role="checkbox" aria-checked={remember}><Text>Remember me</Text></Pressable>
<Pressable onPress={toggle} accessibilityRole="radio" accessibilityState={{ checked: size === 'S' }}>
  <Text>Small</Text>
</Pressable>
<View
  accessible
  accessibilityRole="adjustable"
  accessibilityLabel="Volume"
  accessibilityValue={{ min: 0, max: 10, now: volume }}
/>
```

- `checkbox`, `radio`, `switch` and `togglebutton` need `checked` set to `true` or `false`. Checkboxes may also use `'mixed'`.
- `adjustable`, `slider` and `spinbutton` need `accessibilityValue.now` / `aria-valuenow`, or `accessibilityValue.text` / `aria-valuetext`.
- The native `Switch` and sliders from `@react-native-community/slider` are exempt; they report their value themselves.

Disabled state isn't checked: `Pressable`, `Touchable*` and `Button` expose `disabled` automatically. The old `disabled-state-required` rule ID is accepted and does nothing.

## adjustable-role-required

**Default: error.** Same ID as in react-native-accessibility-engine, with a narrower check (see below).

Custom adjustable controls, like steppers, ratings and custom sliders, usually expose `increment` and `decrement` accessibility actions. VoiceOver only offers them (swipe up or down) when the element has the `adjustable` role. Without it, people using a screen reader can't change the value.

```tsx
// ✗ Actions VoiceOver can't trigger
<View
  accessible
  accessibilityLabel="Quantity"
  accessibilityValue={{ min: 1, max: 9, now: quantity }}
  accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
  onAccessibilityAction={onAction}
/>

// ✓
<View
  accessible
  accessibilityRole="adjustable"
  accessibilityLabel="Quantity"
  accessibilityValue={{ min: 1, max: 9, now: quantity }}
  accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
  onAccessibilityAction={onAction}
/>
```

`adjustable`, `slider` and `spinbutton` all count as adjustable roles. An adjustable element also needs a current value; [state-required](#state-required) checks that.

**Native sliders.** `Slider` from `@react-native-community/slider` is a `UISlider` on iOS and a `SeekBar` on Android, which screen readers already treat as adjustable. It needs no role. Setting a different role, such as `button`, replaces that behavior and is reported.

**Different from react-native-accessibility-engine.** The old rule required `accessibilityRole="adjustable"` on every `Slider`, recognized by its component name. This version doesn't require a role on native sliders, and it checks custom controls by their `increment` / `decrement` actions instead of their name.

## link-role-misused

**Default: error.** Same ID as in react-native-accessibility-engine.

The `link` role tells people that activating the element navigates somewhere. On something that can't be pressed, it's a false promise.

```tsx
// ✗
<Text role="link">Terms of service</Text>

// ✓
<Text role="link" onPress={openTerms}>Terms of service</Text>
<Text>Terms of service</Text>
```

An element inside a pressable may use `link`, since the pressable handles the press.

## no-empty-text

**Default: error.** Same ID as in react-native-accessibility-engine.

Empty `Text` elements can become focus stops that read nothing.

```tsx
// ✗
<Text />
<Text>{error ?? ''}</Text>

// ✓
{error ? <Text>{error}</Text> : null}
```

`Text` with a label, or with an inline image or other element inside it, isn't empty.

## touch-target-size

**Default: warning.**

Small targets are hard to hit, especially for people with motor impairments. Apple recommends 44×44pt and Material Design 48×48dp. WCAG 2.2 sets 24×24 as the AA minimum and 44×44 for AAA.

```tsx
// ✗ 24×24
<Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" style={{ width: 24, height: 24 }} />

// ✓ Bigger, or the same size with hitSlop
<Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" style={{ width: 44, height: 44 }} />
<Pressable
  onPress={close}
  accessibilityRole="button"
  accessibilityLabel="Close"
  style={{ width: 24, height: 24 }}
  hitSlop={10}
/>
```

Change the minimum with `minTouchTarget` (default `44`).

**Limitations.** The test renderer doesn't run layout, so only numeric `width` / `height` (or `minWidth` / `minHeight`) from styles are checked, plus `hitSlop`. If neither dimension is set as a number, the element is skipped. If only one is set, only that one is checked. Inline text links and the native `Switch` are exempt. This is why the rule is a warning by default. Make it an error once your components set explicit sizes.

## text-contrast

**Default: warning.**

Text needs enough contrast with its background to be readable in sunlight, on dim screens and with low vision. WCAG AA requires 4.5:1 for normal text and 3:1 for large text (24 or larger, or 18.66 or larger and bold).

```tsx
// ✗ 1.48:1
<View style={{ backgroundColor: '#fff' }}>
  <Text style={{ color: '#d4d4d4' }}>Forgot password?</Text>
</View>

// ✓ 12.6:1
<View style={{ backgroundColor: '#fff' }}>
  <Text style={{ color: '#333' }}>Forgot password?</Text>
</View>
```

All color formats React Native accepts work (`#rgb`, `#rrggbbaa`, `rgb()`, `rgba()`, `hsl()`, named colors). Semi-transparent text and backgrounds are blended. Color is inherited from enclosing `Text` elements.

**Limitations.** The rule only runs when it knows both colors: a `color` on the `Text` (or an enclosing `Text`), and an opaque `backgroundColor` on the `Text` or an ancestor. Otherwise it's skipped. It can't see images, gradients, `PlatformColor`, the window background, or the platform's default text color. Text over an `ImageBackground` that has a background color can give a false warning.

// Deterministic editor double. The Node runner compiles this with the production
// selection/replacement functions, replacing only macOS AX and keyboard I/O.
private let element = AXUIElementCreateApplication(123)
private var text = ""
private var selection = CFRange(location: 0, length: 0)
private var pendingRange: CFRange?
private var selectionDelay = 0
private var ignoreSelection = false
private var selectedOverride: String?
private var pasteMode = "replace"
private var pasted = 0
private var readable = true
private var rich = false
private var uniformStyle = true
private var changeBeforePaste = false

private func reset(_ value: String, _ range: CFRange? = nil, multiline: Bool = false) {
    text = value
    selection = range ?? CFRange(location: value.utf16.count, length: 0)
    pendingRange = nil
    selectionDelay = 0
    ignoreSelection = false
    selectedOverride = nil
    pasteMode = "replace"
    pasted = 0
    readable = true
    rich = multiline
    uniformStyle = true
    changeBeforePaste = false
}

private func snapshot() -> GrammarField? {
    guard readable else { return nil }
    if let pending = pendingRange {
        if selectionDelay == 0 { selection = pending; pendingRange = nil }
        else { selectionDelay -= 1 }
    }
    let selected = (text as NSString).substring(with: NSRange(location: selection.location, length: selection.length))
    return GrammarField(focus: element, element: element, text: text, selection: selection,
                        reportedSelection: selection, textToCorrect: selection.length > 0 ? selected : text,
                        singleLine: !rich)
}

private func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
    guard name == kAXSelectedTextAttribute else { return nil }
    return (selectedOverride ?? (text as NSString).substring(
        with: NSRange(location: selection.location, length: selection.length))) as CFString
}

private func select(_ range: CFRange, in element: AXUIElement) -> Bool {
    if !ignoreSelection { pendingRange = range }
    return true // Simulate editors which report success before the selection lands.
}

private func rangeAttribute(_ element: AXUIElement, _ name: String, range: CFRange) -> CFTypeRef? {
    guard range.location + range.length <= text.utf16.count else { return nil }
    return (text as NSString).substring(with: NSRange(location: range.location, length: range.length)) as CFString
}

private func canReplaceRichText(_ element: AXUIElement, range: CFRange, removed: String) -> Bool {
    return uniformStyle
}

private func pasteGrammarText(_ inserted: String, stillSelected: () -> Bool) -> String {
    if pasteMode == "permission" { return "permission" }
    if changeBeforePaste { text += " user edit" }
    guard stillSelected() else { return "changed" }
    pasted += 1
    if pasteMode == "append" { text += inserted }
    else {
        text = (text as NSString).replacingCharacters(
            in: NSRange(location: selection.location, length: selection.length), with: inserted)
    }
    selection = CFRange(location: text.utf16.count, length: 0)
    return "posted"
}

private func check(_ condition: @autoclosure () -> Bool, _ message: String) {
    if !condition() { fatalError(message) }
}

reset("I writed an email.")
check(replacePlainText(snapshot()!, correction: "I wrote an email.", currentField: snapshot) == "applied", "whole field must be replaced")
check(text == "I wrote an email." && pasted == 1, "whole field must never append")

reset("👋 I writed an email. Thanks!", CFRange(location: 3, length: "I writed an email.".utf16.count))
check(replacePlainText(snapshot()!, correction: "I wrote an email.", currentField: snapshot) == "applied", "selection must be replaced")
check(text == "👋 I wrote an email. Thanks!" && pasted == 1, "preserve surrounding Unicode text")

reset("I writed an email.")
selectionDelay = 3
check(replacePlainText(snapshot()!, correction: "I wrote an email.", currentField: snapshot) == "applied", "wait for delayed selection")
check(pasted == 1, "paste once after selection settles")

reset("I writed an email.")
ignoreSelection = true
check(replacePlainText(snapshot()!, correction: "I wrote an email.", currentField: snapshot) == "changed", "reject an ignored selection write")
check(pasted == 0 && text == "I writed an email.", "never paste at a collapsed caret")

reset("I writed an email.")
selectedOverride = "different text"
check(replacePlainText(snapshot()!, correction: "I wrote an email.", currentField: snapshot) == "changed", "verify selected text, not only range")
check(pasted == 0, "mismatched selected text must block paste")

reset("I writed an email.")
changeBeforePaste = true
check(replacePlainText(snapshot()!, correction: "I wrote an email.", currentField: snapshot) == "changed", "recheck after shortcut release")
check(pasted == 0 && text.hasSuffix(" user edit"), "preserve concurrent edits")

reset("I writed an email.")
pasteMode = "append"
check(replacePlainText(snapshot()!, correction: "I wrote an email.", currentField: snapshot) == "partial", "never report appending as applied")
check(pasted == 1, "never retry an unconfirmed paste")

reset("I writed an email.")
pasteMode = "permission"
let originalSelection = selection
check(replacePlainText(snapshot()!, correction: "I wrote an email.", currentField: snapshot) == "permission", "propagate paste permission failure")
_ = snapshot()
check(pasted == 0 && sameRange(selection, originalSelection), "restore selection on permission failure")

reset("I writed an email.\nShe have a meeting.", multiline: true)
check(replaceRichText(snapshot()!, correction: "I wrote an email.\nShe has a meeting.", currentField: snapshot) == "applied", "replace paragraph edits")
check(text == "I wrote an email.\nShe has a meeting." && pasted == 2, "preserve paragraph breaks")

reset("I writed an email.", multiline: true)
uniformStyle = false
check(replaceRichText(snapshot()!, correction: "I wrote an email.", currentField: snapshot) == "preview", "keep mixed formatting for review")
check(pasted == 0, "do not flatten mixed styles")

reset("I writed an email.\nShe have a meeting.", multiline: true)
pasteMode = "append"
check(replaceRichText(snapshot()!, correction: "I wrote an email.\nShe has a meeting.", currentField: snapshot) == "partial", "stop rich edits after uncertain paste")
check(pasted == 1, "never continue editing after an uncertain paste")

reset("I writed an email.")
private let original = snapshot()!
text = "My changed draft."
selection = CFRange(location: text.utf16.count, length: 0)
check(replacePlainText(original, correction: "I wrote an email.", currentField: snapshot) == "changed", "reject changed original")
check(pasted == 0 && text == "My changed draft.", "preserve a changed draft")
print("12 grammar replacement scenarios passed")

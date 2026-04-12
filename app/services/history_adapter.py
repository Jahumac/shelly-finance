def adapt_history_for_chart(period, history_data):
    period = (period or "").strip().lower()
    out_labels = []
    out_values = []
    if not history_data:
        return out_labels, out_values

    for row in history_data:
        if not row:
            continue
        label = (row.get("date") if isinstance(row, dict) else None) or ""
        val = (row.get("price") if isinstance(row, dict) else None)

        try:
            v = float(val)
        except Exception:
            continue

        if period == "1d":
            label = str(label)
            if " " in label:
                label = label.split(" ", 1)[1].strip()
            if "T" in label:
                label = label.split("T", 1)[1].strip()
            if len(label) >= 5:
                label = label[:5]
        else:
            label = str(label)
            if " " in label:
                label = label.split(" ", 1)[0].strip()
            if "T" in label:
                label = label.split("T", 1)[0].strip()
            if len(label) >= 10:
                label = label[:10]

        out_labels.append(label)
        out_values.append(round(v, 4))

    return out_labels, out_values

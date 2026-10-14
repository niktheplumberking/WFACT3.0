/**
 * Choose the client's logo file: checked in the browser first (lib/brandUpload.ts, the same rules the build uses), then
 * uploaded to the private client-assets bucket. Shows the chosen logo so the owner can see it is the right one. The
 * parent decides what the record is for (a new request, or a detail on an approved plan).
 */
import { useEffect, useId, useState } from "react";
import { UploadSimple, X } from "@phosphor-icons/react";
import { uploadLogo, type LogoRecord } from "../lib/brandUpload";

export function LogoUpload({
  value,
  onChange,
  disabled,
  label = "Client's logo (optional)",
  hint = "SVG, PNG or WebP, up to 512 KB. It goes in the site's header, footer and browser tab exactly as supplied; the factory never redraws it.",
  variant = "field",
}: {
  value: LogoRecord | null;
  onChange: (record: LogoRecord | null) => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
  /** "drop": the Cockpit v2 drop zone (New request). The file input stays a real, focusable control inside the zone. */
  variant?: "field" | "drop";
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );

  async function choose(file: File | undefined) {
    setError(null);
    if (!file) return;
    setBusy(true);
    const res = await uploadLogo(file);
    setBusy(false);
    if (!res.ok) {
      onChange(null);
      setPreview(null);
      return setError(res.reason);
    }
    setPreview({ url: URL.createObjectURL(file), name: file.name });
    onChange(res.record);
  }

  const [over, setOver] = useState(false);
  if (variant === "drop") {
    return (
      <div className="field">
        <span className="t-label" id={`${id}-cap`}>
          {label}
        </span>
        {value ? (
          <div className="logo-added">
            {preview ? <img src={preview.url} alt={`Chosen logo: ${preview.name}`} /> : <span className="logo-added-blank" aria-hidden="true" />}
            <span className="logo-added-text">
              <b>{preview?.name ?? "Logo added"}</b>
              <span className="t-small muted">
                {value.width}×{value.height} · checked: used exactly as supplied
              </span>
            </span>
            <button
              type="button"
              className="btn quiet"
              disabled={disabled}
              onClick={() => {
                onChange(null);
                setPreview(null);
              }}
            >
              Remove
            </button>
          </div>
        ) : (
          <label
            className={over ? "dropzone over" : "dropzone"}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              if (!disabled && !busy) void choose(e.dataTransfer.files?.[0]);
            }}
          >
            <UploadSimple aria-hidden="true" />
            <span className="dropzone-text">
              <b>{busy ? "Checking and uploading…" : "Drop the logo here, or choose a file"}</b>
              <span className="t-small muted">{hint}</span>
            </span>
            <input
              id={id}
              type="file"
              className="dropzone-input"
              accept=".svg,.png,.webp,image/svg+xml,image/png,image/webp"
              disabled={disabled || busy}
              aria-describedby={`${id}-cap`}
              onChange={(e) => {
                void choose(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        )}
        {error && (
          <span className="hint" role="alert" style={{ color: "var(--stop)" }}>
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {value ? (
        <div className="row-wrap" style={{ gap: 12, alignItems: "center" }}>
          {preview && (
            <span className="logo-chip">
              <img src={preview.url} alt={`Chosen logo: ${preview.name}`} />
            </span>
          )}
          <span className="muted fine">
            {preview ? `${preview.name}, ` : "Logo added, "}
            {value.width}×{value.height}
          </span>
          <button
            type="button"
            className="btn"
            disabled={disabled}
            onClick={() => {
              onChange(null);
              setPreview(null);
            }}
          >
            <X aria-hidden="true" />
            Remove
          </button>
        </div>
      ) : (
        <input
          id={id}
          type="file"
          className="input"
          accept=".svg,.png,.webp,image/svg+xml,image/png,image/webp"
          disabled={disabled || busy}
          aria-describedby={`${id}-h`}
          onChange={(e) => {
            void choose(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      )}
      <span id={`${id}-h`} className="hint">
        {busy ? (
          <>
            <UploadSimple aria-hidden="true" /> Checking and uploading…
          </>
        ) : (
          hint
        )}
      </span>
      {error && (
        <span className="hint" role="alert" style={{ color: "var(--stop)" }}>
          {error}
        </span>
      )}
    </div>
  );
}

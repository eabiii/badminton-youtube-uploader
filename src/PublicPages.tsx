import type { ReactNode } from 'react';

export const PRIVACY_PATH = '/privacy';

export function HomeAbout() {
  return (
    <section className="public-section" aria-labelledby="about-heading">
      <h2 id="about-heading">What this application does</h2>
      <p className="muted">
        Badminton Uploader is a private tool for a small group of trusted Uploaders. It publishes
        individual badminton Games to one YouTube channel and adds each uploaded video to one
        playlist, with the title, description, and visibility filled in from a short form.
      </p>
      <p className="muted">
        The application connects to YouTube through the YouTube API Services using a single
        authorization granted by the channel owner. Uploaders sign in with a shared password and
        never see or handle Google credentials.
      </p>
    </section>
  );
}

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <a href={PRIVACY_PATH}>Privacy Policy</a>
    </footer>
  );
}

function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function PrivacyPolicy() {
  return (
    <main className="policy-shell">
      <article className="policy">
        <p className="eyebrow">Badminton Uploader</p>
        <h1>Privacy Policy</h1>
        <p className="muted">
          This policy explains what information Badminton Uploader handles when it publishes videos
          to YouTube on behalf of its channel owner.
        </p>

        <PolicySection title="Who uses the application">
          <p className="muted">
            Access is limited to trusted Uploaders who have been given a shared password by the
            channel owner. There are no individual accounts, and the application does not collect
            names, email addresses, or other profile details from Uploaders.
          </p>
        </PolicySection>

        <PolicySection title="Information we handle">
          <ul className="muted">
            <li>
              <strong>Videos.</strong> The video file you choose is streamed through the application
              to YouTube in chunks. Video content is never stored by the application.
            </li>
            <li>
              <strong>Game details.</strong> The title, description, visibility, and Players you
              enter are sent to YouTube for the upload. The application does not keep a record of
              completed uploads.
            </li>
            <li>
              <strong>Player and Queuing Directories.</strong> Names and locations that Uploaders
              save for reuse are stored so they can be selected again. They can be renamed, merged,
              or removed within the application.
            </li>
            <li>
              <strong>Sign-in data.</strong> A hashed shared password, a session record behind a
              cookie that keeps you signed in until you log out, and failed sign-in counts keyed to
              a hashed network address to limit password guessing.
            </li>
            <li>
              <strong>Upload coordination.</strong> A temporary record that allows only one upload
              at a time.
            </li>
          </ul>
        </PolicySection>

        <PolicySection title="Google and YouTube data">
          <p className="muted">
            The channel owner authorizes the application once to upload videos and manage a playlist
            on the owner’s YouTube channel. The resulting credentials are stored as protected
            deployment secrets on the server. They are never sent to the browser, shown to
            Uploaders, or written to logs. The application uses them only to upload Games and add
            them to the configured playlist, and it does not sell, share, or use Google user data
            for advertising.
          </p>
          <p className="muted">
            Badminton Uploader’s use and transfer of information received from Google APIs adheres
            to the{' '}
            <a href="https://developers.google.com/terms/api-services-user-data-policy">
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements. The application uses YouTube API Services; by
            using it you agree to be bound by the{' '}
            <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>, and Google’s
            handling of data is described in the{' '}
            <a href="https://policies.google.com/privacy">Google Privacy Policy</a>.
          </p>
          <p className="muted">
            The channel owner can revoke the application’s access at any time from the{' '}
            <a href="https://myaccount.google.com/permissions">Google Account permissions page</a>.
            Revoking access stops all uploads.
          </p>
        </PolicySection>

        <PolicySection title="Hosting and retention">
          <p className="muted">
            The application runs on Cloudflare Workers with a Cloudflare D1 database. Directory
            entries and session records are kept until they are removed or the session is logged
            out. Operational logs are sampled and do not contain passwords, credentials, upload
            contents, or query strings. Videos published to YouTube are managed in YouTube Studio
            and are governed by YouTube’s own policies.
          </p>
        </PolicySection>

        <PolicySection title="Contact">
          <p className="muted">
            Questions about this policy or requests to remove data should go to the channel owner
            who gave you access to the application.
          </p>
        </PolicySection>

        <p>
          <a href="/">Back to Badminton Uploader</a>
        </p>
      </article>
    </main>
  );
}

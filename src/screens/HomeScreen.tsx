import { Btn, Notice } from '../components/ui';
import { APP_NAME, DISCLAIMER_SHORT } from '../i18n/he';
import { useApp } from '../state/AppState';
import { navigate } from '../state/router';

export function HomeScreen() {
  const { settings, updateSettings, storageError, session } = useApp();
  return (
    <main className="page home" id="main">
      <header className="home-head">
        <h1 tabIndex={-1}>{APP_NAME}</h1>
        <p className="lead">תרגול קצר ושקט, בליווי בן משפחה</p>
      </header>

      {!settings.onboardingSeen && (
        <section className="card onboarding" aria-labelledby="welcome-title">
          <h2 id="welcome-title">ברוכים הבאים</h2>
          <ul className="plain-list">
            <li>אתם שולטים בכל לחיצה. הוא רק מסתכל על המסך.</li>
            <li>אין צורך שידבר, יגע או יזיז יד.</li>
            <li>אחרי כל ניסיון אתם רושמים מה ראיתם. אין ציונים ואין זמן קצוב.</li>
            <li>אפשר לעצור בכל רגע. כל המידע נשמר רק במכשיר הזה.</li>
          </ul>
          <Notice kind="warn">{DISCLAIMER_SHORT} כדאי לבדוק עם צוות השיקום שהתרגול מתאים.</Notice>
          <Btn variant="primary" onClick={() => void updateSettings({ onboardingSeen: true })}>
            הבנתי
          </Btn>
        </section>
      )}

      {storageError && (
        <Notice kind="warn" role="alert">
          לא ניתן לשמור נתונים בדפדפן הזה (אולי מצב גלישה פרטית). אפשר לתרגל, אבל התיעוד עלול לא להישמר.
        </Notice>
      )}

      <nav className="home-actions" aria-label="פעולות ראשיות">
        {session && !session.endedAt ? (
          <Btn variant="primary" big onClick={() => navigate('exercise')} data-testid="resume-session">
            חזרה לתרגול הפתוח
          </Btn>
        ) : (
          <Btn variant="primary" big onClick={() => navigate('start')} data-testid="home-start">
            התחל תרגול
          </Btn>
        )}
        <Btn big onClick={() => navigate('progress')} data-testid="home-progress">
          התקדמות
        </Btn>
        <Btn big onClick={() => navigate('settings')} data-testid="home-settings">
          הגדרות ועזרה
        </Btn>
      </nav>

      <footer className="home-foot">
        <p>{DISCLAIMER_SHORT}</p>
      </footer>
    </main>
  );
}

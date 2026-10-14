import { useState } from 'react';
import type { JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import { createApplication } from '../../api';
import type { CreateLoanApplication, LoanApplication } from '../../api';
import { LoanApplicationForm } from '../components/loan-application-form';
import { ErrorMessage } from '../components/ui/error-boundary';

export function CreateApplicationPage(): JSX.Element {
  const navigate = useNavigate();
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [createdError, setCreatedError] = useState<string | null>(null);

  async function handleSubmit(
    payload: CreateLoanApplication,
  ): Promise<LoanApplication> {
    setCreatedError(null);
    const created = await createApplication(payload);
    setCreatedId(created.id);
    navigate(`/applications/${created.id}`, { replace: true });
    return created;
  }

  return (
    <section aria-labelledby="apply-title">
      <h1 id="apply-title" style={{ marginTop: 0 }}>
        Apply for a personal loan
      </h1>
      <p className="muted">
        Fill in your details to start a new application. New
        applications are created with a PENDING status and a credit
        check is scheduled automatically.
      </p>

      {createdError ? <ErrorMessage message={createdError} /> : null}

      <div className="card">
        <LoanApplicationForm onSubmit={handleSubmit} />
      </div>

      {createdId ? (
        <p className="muted">
          Application created: <code>{createdId}</code>
        </p>
      ) : null}
    </section>
  );
}

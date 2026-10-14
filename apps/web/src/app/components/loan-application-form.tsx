import { useState, type FormEvent, type ReactElement } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/form';
import { ErrorMessage } from './ui/error-boundary';
import { PurposeSelect } from './purpose-select';
import {
  isValidEmail,
  normalizeEmail,
} from '../lib/validation';
import {
  isMalaysianNric,
  normalizeNric,
  isMalaysianPhone,
  normalizePhone,
  isCurrency,
} from '../lib/nric-phone';
import type { CreateLoanApplication, LoanApplication } from '../../api';

const MALAYSIAN_PHONE_HELPER = '+60 12-345 6789, 0123456789, or 03-1234 5678';

interface FormValues {
  fullName: string;
  nric: string;
  phone: string;
  email: string;
  monthlyIncome: string;
  loanAmount: string;
  tenureMonths: string;
  purposeId: string;
}

interface FormErrors {
  fullName?: string;
  nric?: string;
  phone?: string;
  email?: string;
  monthlyIncome?: string;
  loanAmount?: string;
  tenureMonths?: string;
  purposeId?: string;
  server?: string;
}

export interface LoanApplicationFormProps {
  readonly onSubmit: (payload: CreateLoanApplication) => Promise<LoanApplication>;
  readonly isSubmitting?: boolean;
}

export function LoanApplicationForm({
  onSubmit,
  isSubmitting,
}: LoanApplicationFormProps): ReactElement {
  const [values, setValues] = useState<FormValues>({
    fullName: '',
    nric: '',
    phone: '',
    email: '',
    monthlyIncome: '',
    loanAmount: '',
    tenureMonths: '',
    purposeId: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  function setField<K extends keyof FormValues>(key: K, value: string): void {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) {
      setErrors((e) => ({ ...e, [key]: undefined, server: undefined }));
    }
  }

  function validate(): boolean {
    const next: FormErrors = {};

    if (!values.fullName.trim()) {
      next.fullName = 'Full name is required.';
    } else if (values.fullName.trim().length > 255) {
      next.fullName = 'Full name must be at most 255 characters.';
    }

    if (!values.nric.trim()) {
      next.nric = 'NRIC is required.';
    } else if (!isMalaysianNric(values.nric)) {
      next.nric =
        'NRIC must be 12 digits with a valid date of birth (e.g. 900101145678 or 900101-14-5678).';
    }

    if (!values.phone.trim()) {
      next.phone = 'Phone number is required.';
    } else if (!isMalaysianPhone(values.phone)) {
      next.phone = `Enter a valid Malaysian number (${MALAYSIAN_PHONE_HELPER}).`;
    }

    if (!values.email.trim()) {
      next.email = 'Email is required.';
    } else if (!isValidEmail(values.email)) {
      next.email = 'Enter a valid email address.';
    }

    if (!values.monthlyIncome) {
      next.monthlyIncome = 'Monthly income is required.';
    } else if (!isCurrency(values.monthlyIncome)) {
      next.monthlyIncome = 'Enter a valid amount in RM (up to 2 decimals).';
    }

    if (!values.loanAmount) {
      next.loanAmount = 'Loan amount is required.';
    } else if (!isCurrency(values.loanAmount)) {
      next.loanAmount = 'Enter a valid amount in RM (up to 2 decimals).';
    }

    const tenure = Number(values.tenureMonths);
    if (!values.tenureMonths) {
      next.tenureMonths = 'Tenure is required.';
    } else if (!Number.isInteger(tenure)) {
      next.tenureMonths = 'Tenure must be a whole number of months.';
    } else if (tenure < 6) {
      next.tenureMonths = 'Tenure must be at least 6 months.';
    } else if (tenure > 360) {
      next.tenureMonths = 'Tenure must be at most 360 months.';
    }

    if (!values.purposeId) {
      next.purposeId = 'Please select a loan purpose.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitted(true);
    if (!validate()) return;

    const payload: CreateLoanApplication = {
      fullName: values.fullName.trim(),
      nric: normalizeNric(values.nric),
      phone: normalizePhone(values.phone),
      email: normalizeEmail(values.email),
      monthlyIncome: Number(values.monthlyIncome),
      loanAmount: Number(values.loanAmount),
      tenureMonths: Number(values.tenureMonths),
      purposeId: values.purposeId,
    };

    try {
      await onSubmit(payload);
      setErrors((e) => ({ ...e, server: undefined }));
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (status === 409) {
        setErrors({ server: 'An application with this NRIC already exists.' });
      } else if (status === 400) {
        setErrors({
          server:
            'The selected loan purpose is no longer available or was not recognized.',
        });
      } else {
        setErrors({ server: 'Could not submit the application.' });
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-invalid={Boolean(errors.server)}>
      <Input
        label="Full name"
        placeholder="John Doe"
        value={values.fullName}
        onChange={(e) => setField('fullName', e.target.value)}
        error={submitted ? errors.fullName : undefined}
        aria-invalid={Boolean(submitted && errors.fullName)}
        disabled={isSubmitting}
        required
      />
      <Input
        label="NRIC"
        placeholder="900101-14-5678"
        value={values.nric}
        onChange={(e) => setField('nric', e.target.value)}
        error={submitted ? errors.nric : undefined}
        aria-invalid={Boolean(submitted && errors.nric)}
        disabled={isSubmitting}
        required
      />
      <Input
        label="Phone number"
        placeholder={MALAYSIAN_PHONE_HELPER}
        value={values.phone}
        onChange={(e) => setField('phone', e.target.value)}
        error={submitted ? errors.phone : undefined}
        aria-invalid={Boolean(submitted && errors.phone)}
        disabled={isSubmitting}
        required
      />
      <Input
        label="Email"
        type="email"
        placeholder="you@example.com"
        value={values.email}
        onChange={(e) => setField('email', e.target.value)}
        error={submitted ? errors.email : undefined}
        aria-invalid={Boolean(submitted && errors.email)}
        disabled={isSubmitting}
        required
      />
      <Input
        label="Monthly income (RM)"
        placeholder="5000"
        value={values.monthlyIncome}
        onChange={(e) => setField('monthlyIncome', e.target.value)}
        error={submitted ? errors.monthlyIncome : undefined}
        aria-invalid={Boolean(submitted && errors.monthlyIncome)}
        disabled={isSubmitting}
        required
      />
      <Input
        label="Loan amount (RM)"
        placeholder="20000"
        value={values.loanAmount}
        onChange={(e) => setField('loanAmount', e.target.value)}
        error={submitted ? errors.loanAmount : undefined}
        aria-invalid={Boolean(submitted && errors.loanAmount)}
        disabled={isSubmitting}
        required
      />
      <Input
        label="Tenure (months)"
        type="number"
        min={6}
        max={360}
        placeholder="24"
        value={values.tenureMonths}
        onChange={(e) => setField('tenureMonths', e.target.value)}
        error={submitted ? errors.tenureMonths : undefined}
        aria-invalid={Boolean(submitted && errors.tenureMonths)}
        disabled={isSubmitting}
        required
      />
      <PurposeSelect
        value={values.purposeId}
        onChange={(v) => setField('purposeId', v)}
        error={submitted ? errors.purposeId : undefined}
        disabled={isSubmitting}
      />

      {errors.server ? <ErrorMessage message={errors.server} /> : null}

      <div className="form-actions">
        <Button
          type="submit"
          isLoading={isSubmitting}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Submitting…' : 'Submit application'}
        </Button>
      </div>
    </form>
  );
}

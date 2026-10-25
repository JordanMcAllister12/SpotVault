import { LegalPageShell, LegalSection } from '@/components/LegalPageShell';

interface Props {
  onBack?: () => void;
  embedded?: boolean;
}

export function TermsOfServicePage({ onBack, embedded }: Props) {
  return (
    <LegalPageShell title="Terms of Service" subtitle="The Terms Governing Your Use of SpotVault" onBack={onBack} embedded={embedded}>
      <LegalSection number={1} title="Acceptance of Terms">
        <p>
          By accessing or using SpotVault (the "Services"), you agree to be bound by these Terms of Service. If you do not agree to these Terms, you must not access or use the Services.
        </p>
        <p>These Terms are effective as of November 1, 2026.</p>
      </LegalSection>

      <LegalSection number={2} title="Eligibility">
        <p>
          You must be at least 18 years of age to use the Services. By using the Services, you represent and warrant that you meet this requirement and that you are legally able to enter into binding agreements.
        </p>
      </LegalSection>

      <LegalSection number={3} title="Account Registration">
        <p>
          You must provide accurate and complete information when creating an account. You are responsible for maintaining the security of your account credentials and for all activity that occurs under your account.
        </p>
      </LegalSection>

      <LegalSection number={4} title="User Responsibilities">
        <p>
          You agree to use the Services lawfully and respectfully. You are responsible for your conduct and any content you post or share. You agree not to misuse the platform, interfere with other users, or attempt to disrupt or compromise the Services.
        </p>
      </LegalSection>

      <LegalSection number={5} title="Memberships and Subscriptions">
        <p>
          SpotVault may offer membership or subscription plans. Subscription details, including pricing, features, and billing cycles, are presented at the time of purchase. By subscribing, you agree to the applicable plan terms.
        </p>
      </LegalSection>

      <LegalSection number={6} title="Billing and Renewals">
        <p>
          Subscriptions may automatically renew at the end of each billing cycle unless cancelled. You may cancel a subscription at any time. Cancellation takes effect at the end of the current billing period unless otherwise stated.
        </p>
      </LegalSection>

      <LegalSection number={7} title="SpotVault Credits">
        <p>
          SpotVault Credits are a virtual currency used within the platform for purchases, tips, and other transactions. Credits have no cash value, are non-transferable, and may not be redeemed for cash unless required by law. Unused Credits may be subject to expiration as described at the time of acquisition.
        </p>
      </LegalSection>

      <LegalSection number={8} title="Marketplace Purchases">
        <p>
          The SpotVault Marketplace allows users to purchase content, services, and other items. Transaction terms, including refund eligibility, are presented at the time of purchase. SpotVault may charge platform fees on certain transactions.
        </p>
      </LegalSection>

      <LegalSection number={9} title="Creator Content">
        <p>
          Creators may publish content to the Public Library or other areas of the platform. Creators are responsible for ensuring they have the rights to publish their content and that it complies with these Terms and applicable law.
        </p>
      </LegalSection>

      <LegalSection number={10} title="Platform Fees">
        <p>
          SpotVault may charge fees on certain transactions, including marketplace sales, coaching sessions, and creator payouts. Fee structures are disclosed at the time of transaction or in applicable pricing pages.
        </p>
      </LegalSection>

      <LegalSection number={11} title="Refunds">
        <p>
          Refund eligibility depends on the type of purchase and is presented at the time of transaction. Subscription refunds, where applicable, are handled in accordance with the billing terms in effect at the time of purchase.
        </p>
      </LegalSection>

      <LegalSection number={12} title="User-Generated Content">
        <p>
          You retain ownership of content you create and post on SpotVault. By posting content, you grant SpotVault a license to host, display, and distribute that content within the Services. You are responsible for ensuring your content does not violate applicable law or the rights of others.
        </p>
      </LegalSection>

      <LegalSection number={13} title="Public Library / My Spots">
        <p>
          The Public Library contains content shared by users for the benefit of the community. My Spots is your private collection. Content you publish to the Public Library may be accessed by other users in accordance with the platform's sharing settings.
        </p>
      </LegalSection>

      <LegalSection number={14} title="Coaching and Student Features">
        <p>
          SpotVault provides tools for coaches and students to connect, schedule sessions, and share materials. SpotVault facilitates these connections but does not guarantee the quality or outcome of any coaching relationship. Users are responsible for their own interactions.
        </p>
      </LegalSection>

      <LegalSection number={15} title="Analytics and Poker Data">
        <p>
          SpotVault provides analytics tools that process poker hand histories and related data you provide. These tools are for educational and informational purposes. Analytics are based on the data you submit and may not reflect your complete playing history.
        </p>
      </LegalSection>

      <LegalSection number={16} title="Educational / Informational Disclaimer">
        <p>
          SpotVault is a poker education, analytics, content, community, and marketplace platform. Content and tools provided on the platform are for educational and informational purposes only and do not constitute professional advice.
        </p>
      </LegalSection>

      <LegalSection number={17} title="No Gambling Services">
        <p>
          SpotVault is not a gambling operator, sportsbook, casino, poker operator, or gambling payment processor. SpotVault does not facilitate real-money wagering, betting, or gambling of any kind. Any references to poker are in the context of education, analytics, and community.
        </p>
      </LegalSection>

      <LegalSection number={18} title="Community Conduct">
        <p>
          You agree to treat other users with respect. Harassment, hate speech, threats, and other forms of abusive behavior are not tolerated. SpotVault reserves the right to remove content and take action against accounts that violate community standards.
        </p>
      </LegalSection>

      <LegalSection number={19} title="Prohibited Conduct">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>Use the Services for any unlawful purpose</li>
          <li>Harass, threaten, or harm other users</li>
          <li>Post content that infringes the rights of others</li>
          <li>Attempt to gain unauthorized access to the platform</li>
          <li>Use bots, scrapers, or automated tools without permission</li>
          <li>Resell or redistribute the Services without authorization</li>
          <li>Interfere with or disrupt the Services or servers</li>
        </ul>
      </LegalSection>

      <LegalSection number={20} title="Intellectual Property">
        <p>
          The SpotVault platform, including its design, branding, software, and features, is owned by SpotVault Technologies Inc. and protected by intellectual property laws. User-generated content remains the property of its respective creators.
        </p>
      </LegalSection>

      <LegalSection number={21} title="Content Licenses">
        <p>
          By posting content on SpotVault, you grant the platform a non-exclusive, royalty-free license to use, display, and distribute your content within the Services. You may remove this license by deleting your content, subject to retention requirements described in the Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection number={22} title="Account Suspension / Termination">
        <p>
          SpotVault may suspend or terminate your account if you violate these Terms, engage in harmful conduct, or for any other reason at our discretion. Upon termination, your right to use the Services ceases immediately.
        </p>
      </LegalSection>

      <LegalSection number={23} title="Third-Party Services">
        <p>
          The Services may integrate with or link to third-party tools and platforms. SpotVault is not responsible for the practices or content of third parties. Your use of third-party services is subject to their own terms.
        </p>
      </LegalSection>

      <LegalSection number={24} title="Disclaimers">
        <p>
          The Services are provided "as is" and "as available" without warranties of any kind. SpotVault does not guarantee that the Services will be uninterrupted, error-free, or secure. To the fullest extent permitted by law, SpotVault disclaims all warranties, express or implied.
        </p>
      </LegalSection>

      <LegalSection number={25} title="Limitation of Liability">
        <p>
          To the fullest extent permitted by law, SpotVault and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Services. Total liability for any claim shall not exceed the amount you paid to SpotVault in the preceding twelve months.
        </p>
      </LegalSection>

      <LegalSection number={26} title="Indemnification">
        <p>
          You agree to indemnify and hold SpotVault harmless from claims, damages, and expenses arising from your use of the Services, your content, or your violation of these Terms.
        </p>
      </LegalSection>

      <LegalSection number={27} title="Changes to Services">
        <p>
          SpotVault may modify, suspend, or discontinue features or the entire Services at any time. We are not liable to you for any changes to the Services.
        </p>
      </LegalSection>

      <LegalSection number={28} title="Changes to Terms">
        <p>
          We may update these Terms from time to time. We will notify users of material changes through the Services or by other means. Continued use of the Services after a change constitutes acceptance of the updated Terms.
        </p>
      </LegalSection>

      <LegalSection number={29} title="Governing Law">
        <p>
          These Terms are governed by the laws of the Province of Manitoba, Canada, without regard to conflict of law principles. Disputes shall be resolved in the courts of the Province of Manitoba, Canada, unless otherwise required by applicable law.
        </p>
      </LegalSection>

      <LegalSection number={30} title="Contact Information">
        <p>If you have questions about these Terms, you may contact us at:</p>
        <p>
          SpotVault Technologies Inc.<br />
          1700–242 Hargrave Street, Winnipeg, Manitoba R3C 0V1, Canada<br />
          <a href="mailto:ceo@thespotvault.com" className="text-[#d4a52c] underline decoration-[#d4a52c]/30 underline-offset-2 hover:decoration-[#d4a52c]">ceo@thespotvault.com</a>
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}

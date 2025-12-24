-- =====================================================
-- UPDATE AGREEMENT TEMPLATE WITH FULL LEGAL CONTENT
-- =====================================================
-- This updates the agreement template to include the complete
-- legal agreement text (all 16 pages) instead of the summary

DELETE FROM public.agreement_templates WHERE version = 'v4.0';

INSERT INTO public.agreement_templates (
  version,
  title,
  content_html,
  content_pdf_url,
  summary_points,
  is_active,
  effective_from
) VALUES (
  'v4.0',
  'Independent Contractor Agreement',

  -- FULL HTML CONTENT (complete 16-page agreement)
  $$<div class="full-agreement">
    <style>
      .full-agreement { font-family: Arial, sans-serif; line-height: 1.6; color: #2c3e50; }
      .full-agreement h2 { color: #007e8c; border-bottom: 2px solid #007e8c; padding-bottom: 10px; margin-top: 30px; }
      .full-agreement h3 { color: #007e8c; margin-top: 25px; font-size: 1.1em; }
      .full-agreement h4 { color: #2c3e50; margin-top: 20px; font-size: 1em; font-weight: bold; }
      .full-agreement p { margin: 10px 0; }
      .full-agreement ul, .full-agreement ol { margin: 10px 0; padding-left: 30px; }
      .full-agreement li { margin: 8px 0; }
      .full-agreement .section { margin-bottom: 25px; }
      .full-agreement .clause { margin: 15px 0; }
      .full-agreement strong { color: #2c3e50; }
      .full-agreement .indent { margin-left: 30px; }
    </style>

    <div class="section">
      <h2>RECITALS</h2>
      <p><strong>A.</strong> The Principal conducts the business known as <strong>Rejuvenators Mobile Massage</strong>.</p>
      <p><strong>B.</strong> The Principal has agreed to use the services of the Contractor and the Contractor has agreed to provide those services on the terms and conditions set out in this agreement.</p>
    </div>

    <div class="section">
      <h2>OPERATIVE PART</h2>

      <h3>1. Definitions</h3>
      <div class="clause">
        <p><strong>Agreement</strong> means this Agreement includes the terms and documents in the Appendix.</p>
        <p><strong>Appendix</strong> means the appendix attached to this Agreement.</p>
        <p><strong>Confidential Information</strong> includes (but is not limited to):</p>
        <ul>
          <li>trade secrets of the Principal; the Principal's policies, systems and protocols;</li>
          <li>information about the business and affairs of the Principal such as pricing information, marketing or strategic plans, commercial and business plans, financial information and data, and operational information and methods;</li>
          <li>information about clients or customers of the Principal, such as their specific requirements, arrangements and past dealings with the Principal;</li>
          <li>client lists, customer lists, business cards and diaries, calendars or schedulers; and</li>
          <li>all other information obtained from the Principal or obtained in the course of your employment with the Principal, that is by its nature confidential.</li>
        </ul>

        <p><strong>Contract Period</strong> means a duration of 12 months commencing from the Execution Date and ending on the earlier of the Expiry Date or the Termination Date.</p>

        <p><strong>Contract Price</strong> means unless otherwise agreed, the fees, rates and charges as set out in the Appendix.</p>

        <p><strong>Clients</strong> means, as the context requires, any hotel or organisation which has an arrangement with the Principal for promotional purposes, or any person who has booked services, or any person for whom the Contractor has performed or intended to perform a service under this Agreement.</p>

        <p><strong>Contractor</strong> means the entity nominated in this Agreement and its officers, agents, subcontractors, employees and consultants.</p>

        <p><strong>Contractor's Representative</strong> means the person nominated by the Contractor to represent the business.</p>

        <p><strong>Day/Days</strong> means calendar day/days.</p>

        <p><strong>Execution Date</strong> means the date the last party signs this Agreement.</p>

        <p><strong>Expiry Date</strong> means the date falling 12 months after the Execution Date.</p>

        <p><strong>Intellectual Property</strong> means any industrial or intellectual property and associated rights, whether recognised under the general law or by statute, including:</p>
        <ul>
          <li>Confidential Information; and</li>
          <li>inventions, discoveries, novel designs, patents, and trademarks whether or not they are legally registered or registrable in any jurisdiction; and</li>
          <li>copyright in Works; and</li>
          <li>intellectual property created for, or acquired for the benefit of, any of the Principal's Associated Entities.</li>
        </ul>

        <p><strong>Rejuvenators</strong> means the Rejuvenators Mobile Massage.</p>

        <p><strong>Parties</strong> refers the Principal and the Contractor.</p>

        <p><strong>Rejuvenators Contractor's Information Manual</strong> means a document that the Contractor can refer to when providing the Services, accessible from https://rejuvenators.com/manual/.</p>

        <p><strong>Services</strong> means massage services provided to clients of the Principal, including those set out in the Appendix, as varied by agreement from time to time.</p>

        <p><strong>Start Date</strong> means the Execution Date.</p>

        <p><strong>Termination Date</strong> means the Expiry Date or when the Agreement is terminated in accordance with Clause 6, whichever occurs first.</p>
      </div>

      <h3>2. Appointment</h3>
      <div class="clause">
        <p><strong>2.1</strong> The Principal appoints the Contractor to provide the Services in accordance with this Agreement.</p>

        <p><strong>2.2</strong> The parties acknowledge that the relationship created by this Agreement is that of principal and independent contractor and not any other relationship and, in particular, not the relationship of employer and employee, principal and agent or a relationship of partnership.</p>

        <p><strong>2.3</strong> The Contractor is an independent contractor without authority to bind the Principal by contract or otherwise and neither the Contractor nor the Contractor's personnel are, and must not represent itself as, agents, employees, partners or joint ventures of the Principal by virtue of this Agreement.</p>

        <p><strong>2.4</strong> This is a non-exclusive agreement. The Contractor may provide services to other clients during the term of this Agreement provided that such activities do not interfere with the Contractor's obligations under this Agreement.</p>

        <p><strong>2.5</strong> This Agreement begins on the Execution Date and continues until the Expiry Date, unless terminated prior to that date in accordance with Clause 6.</p>

        <p><strong>2.6</strong> If neither party makes an election under Clause 6 then this Agreement will continue on the same terms after the initial contract period, except that either party may end the agreement by thirty (30) days' notice at any time.</p>
      </div>

      <h3>3. Contract Period</h3>
      <div class="clause">
        <p><strong>3.1 Term</strong></p>
        <p>This Agreement shall remain in effective for a period of twelve (12) months from the Execution Date and will be deemed to be renewed for a further period of 12 months on each anniversary of the Execution Date unless otherwise terminated in accordance with this Agreement or agreed in writing by the parties.</p>
      </div>

      <h3>4. Contractor's Obligations</h3>

      <h4>4.1 Standard of Service</h4>
      <p>When carrying out the Services the Contractor is to refer to the Rejuvenator Contractor's Information Manual for the Principal's requirements as to how the Services referred to in Appendix are to be provided. As a minimum, the Contractor must complete the online training course for the signature StressBuster Massage as provided on the Rejuvenators' website.</p>

      <h4>4.2 Service</h4>
      <ul>
        <li>The Principal engages and agrees to contract with the Contractor and the Contractor agrees to faithfully and diligently perform the Services in accordance with accepted industry standards and professional practices.</li>
        <li>The Contractor will make themselves available for service at dates and times that suit them via the Principal's App calendar.</li>
        <li>The Contractor is not subject to precise hours but if the Contractor has made themselves available for service via the Principals App calendar then the Contractor accepts that a booking request will be sent to them to accept or decline within those that given periods.</li>
        <li>The Contractor will use reasonable endeavours to promote the Principal's business, and to procure and coordinate bookings for the Contractor within the scope of this Agreement.</li>
        <li>The Contractor acknowledges that during the period of this Agreement the Principal:
          <ul>
            <li>is not bound to use the Contractor to provide the Services; and</li>
            <li>may, at any time, carry out the Services itself or engage others to carry out the Services on its behalf.</li>
          </ul>
        </li>
      </ul>

      <h4>4.3 Cancellation and Failure to Deliver Services</h4>

      <p><strong>Cancellations or No-Shows by Contractors:</strong></p>
      <p>If a contractor cancels or fails to show up for a scheduled mobile massage appointment <strong>within 1 hour</strong> of the scheduled time, the following actions will be taken:</p>
      <ul>
        <li><strong>Client Notification:</strong> The client will be immediately notified of the cancellation or no-show, and we will offer to reschedule the appointment at the client's convenience.</li>
        <li><strong>Refund or Reschedule:</strong> The client will be offered a <strong>full refund</strong> or a <strong>free rescheduled session</strong> on the next appointment as compensation for the inconvenience caused by the late cancellation or no-show.</li>
        <li><strong>Follow-up Action:</strong> In the event that the client elects for a full refund, the contractor will be charged the <strong>full amount of the booking</strong> and that will be deducted from their next invoice. Additionally, you will be reminded about the importance of adhering to scheduling commitments. Repeated incidents of cancellations or no-shows may result in further action or a review of your contract.</li>
      </ul>
      <p>We strive to avoid any disruptions to our clients and ensure that every experience with us is positive and professional.</p>

      <p><strong>Cancellations or No-Shows by Clients:</strong></p>
      <p>To maintain an organised schedule, clients are required to notify us via our booking portal of any cancellations or rescheduling requests at least <strong>3 hours in advance</strong>. Cancellations made less than 3 hours before the scheduled appointment, or clients who do not show up for the appointment, will incur the following fees:</p>
      <ul>
        <li><strong>Cancellations with less than 3 hours' notice:</strong> A charge of <strong>100% of the scheduled session fee</strong>.</li>
        <li><strong>Contractors</strong> will receive the <strong>full payment</strong> for the session as per the contract schedule.</li>
        <li><strong>Cancellations with more than 3 hours' notice:</strong> No charge will be placed on the client and the Contractor will not receive any fees.</li>
      </ul>

      <h4>4.4 Rates</h4>
      <p>The rates payable by Principal to Contractor for Services to be provided are shown in Appendix. As a general directive Contractors will be offered a rate of <strong>55% of the Jobs Recommended Retail Price</strong> as per our website. The Principal reserves the right to amend this at any time. Advice of any change will be given in writing with 14 days' notice.</p>

      <h4>4.5 Contractor's warranties, indemnities and acknowledgements</h4>
      <p>The Contractor warrants during the whole Contract Period:</p>
      <ul>
        <li>The Contractor holds and warrants to the currency of any qualifications, licences or permits or memberships of any organisation as may be required to provide the Services. The Principal must be provided with copies or of the above required documents whenever reasonably required during the Contract Period.</li>
        <li>The Contractor warrants to observe the reasonable directions given by the Principal or the Principal's Clients in relation to security or use of any premises, facilities or equipment that does not belong to the Contractor.</li>
        <li>The Contractor warrants to supply all plant and equipment necessary for the performance of the Services and ensure all tools and equipment provided by the Contractor and used to provide the Services are always in good, proper and serviceable repair and order and are maintained in a safe working condition during the contract period.</li>
        <li>The Contractor will be responsible for all expenses incurred in providing the Services under this Contract unless otherwise specified in this Agreement.</li>
        <li>The Contractor warrants that the details the Contractor has provided to the Principal about the Contractor and the Contractor's experience and qualifications are accurate. The Contractor will keep the Principal informed in writing as soon as the Contractor becomes aware of any conflict of interest or issue that may adversely affect the Contractor's ability to carry out the Services.</li>
        <li>The Contractor warrants that the Contractor and each of the Contractor's employees, and third parties engaged by the Contractor to perform the Services have valid visas to work in Australia and perform the Services. The Contractor must provide to the Principal on request copies of each such person's visa letter or Visa Entitlement Verification Online (VEVO) Check during the Contract Period.</li>
        <li>It does not hold any interest or have any obligation, whether directly or indirectly by virtue of a contract or otherwise, which may conflict with the responsibilities of the Contractor under this Agreement.</li>
      </ul>
      <p>A breach of any of the above warranties will constitute a default, entitling the Principal to terminate this Agreement pursuant to Clause 6.2(a) and to reserve Principal's right to make a claim for its losses.</p>

      <h4>4.6 Guarantee of Quality</h4>
      <p>The Principal, as part of its service offering provides a 100% money back quality guarantee.</p>
      <ul>
        <li>In relation to that guarantee of quality:
          <ul>
            <li>The Principal may reimburse a client claim for refund and will not require any part of that refund to be paid by the Contractor</li>
            <li>In the event that the Principal is required to make three individual client refunds in a six month period the Principal may terminate this Agreement immediately by a written notice to the Contractor. This is in addition to any of the Principal's other rights of termination under this Agreement or at law.</li>
          </ul>
        </li>
      </ul>

      <h4>4.7 Confidentiality</h4>
      <ul>
        <li>The Contractor agrees to keep all Confidential Information confidential.</li>
        <li>The Contractor must not use or disclose Confidential Information without the Principal's written authority, either during or after the term of this Agreement.</li>
        <li>The Contractor's obligations in Clause 4.7 do not apply to:
          <ul>
            <li>information that is publicly available, unless the information has only become public available because of a breach by the Contract or someone else of the Principal's confidence; or</li>
            <li>Disclosure of Confidential Information that is legally required, provided the Contractor have made reasonable attempts to avoid disclosure and have give the Principal a reasonable opportunity to protect Principal's interest in the information.</li>
          </ul>
        </li>
        <li>The Contractor must follow the Principal's directions regarding the Confidential Information, and return (or destroy) all copies of the Confidential Information as directed by the Principal.</li>
        <li>The Contractor acknowledges that the Principal may apply for an injunction to stop any actual or imminent breaches of this the Contractor's obligations under this Agreement.</li>
      </ul>

      <h4>4.8 Insurance, Taxation and Superannuation</h4>
      <p>The Contractor is responsible for:</p>
      <ul>
        <li>maintenance of its own prudent insurance policies, including:
          <ul>
            <li>workers' compensation.</li>
            <li>vehicle and equipment insurance; and</li>
            <li>public and products liability insurance of <strong>$10,000,000.00 or over</strong>.</li>
          </ul>
        </li>
        <li>Payment of its own superannuation.</li>
        <li>payment of all relevant taxes including income tax and payroll tax.</li>
        <li>employment benefits due to the Contractor's employees.</li>
      </ul>

      <h4>4.9 Workplace Health and Safety</h4>
      <ul>
        <li>The Contractor must at all times ensure that any person performing the Services provided by or on behalf of the Contractor complies with all relevant workplace health and safety laws, including Industry codes of practice and advisory standards.</li>
        <li>If the Contractor fails to comply with its obligations under clause (a) in addition to the Principal's other rights and remedies, the Principal may have the obligation performed by others. The cost thereby incurred will be deemed to be a debt due and payable by the Contractor to the Principal.</li>
        <li>The Principal may, at its discretion:
          <ul>
            <li>Review the Contractor's Work Health and Safety (WHS) system to ensure that it includes the minimum requirements.</li>
            <li>Conduct a compliance audit which checks that records that are legally required are retained within the Contractors' WHS system.</li>
            <li>Conduct worksite audits specific to the work being completed on contracting personnel.</li>
          </ul>
        </li>
        <li>The Contractor will:
          <ul>
            <li>Report any hazards to the Principal that relate to the Principal's activities or plant/equipment;</li>
            <li>Report all incidents to the Principal as defined in the Principal's WHS system;</li>
            <li>Participate in worksite audits as required by the Principal.</li>
          </ul>
        </li>
      </ul>

      <h4>4.10 Contractor's Employees</h4>
      <ul>
        <li>The Contractor shall employ such employees as are necessary for the proper performance of the Services and who are skilled, experienced and competent in their respective trades, and is responsible for ensuring that employees have the relevant qualifications and training to an acceptable industry standard.</li>
        <li>The Contractor shall submit to the Principal the names and qualifications of the Contractor's employees who will be engaged in performing the Services, in each case not less than 96 hours before the commencement of engagement of an employee in performing the Services.</li>
        <li>The Contractor warrants and is responsible for the replacement or removal of any person who is unsuitable to be engaged in the performance of the Services.</li>
      </ul>

      <h4>4.11 Therapist App</h4>
      <ul>
        <li>The Contractor shall download and at all times maintain the Principal's provided work applicatoin (the "App") on their mobile phone or other electronic device, such as a tablet. The App enables the Contractor to update the progress of each job from start to finish.</li>
        <li>To receive job offers and ensure accurate and timely invoicing for services rendered, the App must be kept up to date. The Principal will provide full training on the use of the App, along with any necessary training on updates to the platform. The Contractor must undertake such training as required to remain an active Contractor for the business.</li>
      </ul>

      <h3>5. Invoices and GST</h3>

      <h4>5.1 Itemised Report and Invoicing</h4>
      <p>The Principal will provide to the Contractor an itemised report of services delivered via the online booking platform on a weekly basis. Within seven (7) days of receiving the report, the Contractor must submit a correctly rendered invoice referencing the itemised report. Once the Principal has verified the invoiced details to its satisfaction, it will pay the Contractor the amount invoiced or such portion of the invoice that the Principal determines relates to services provided in accordance with this Agreement. The Principal may deduct from any payments to the Contractor any amounts it is legally required to withhold.</p>

      <h4>5.2 Frequency of Invoices</h4>
      <p>The Contractor must submit invoices to the Principal on a weekly basis unless otherwise agreed between the Principal and the Contractor.</p>

      <h4>5.3 Request for Additional Information</h4>
      <p>Upon receiving an invoice, the Principal may request additional information from the Contractor to determine whether the amount invoiced is payable.</p>

      <h4>5.4 Correctly Rendered Invoices</h4>
      <p>An invoice is considered correctly rendered if it:</p>
      <ul>
        <li>Correctly calculates the Contract Price and reflects an amount due for payment.</li>
        <li>Is in the form of a Tax Invoice and includes the Contractor's Australian Business Number (ABN).</li>
        <li>Specifies the total amount payable and the GST payable, calculated in accordance with the A New Tax System (Goods and Services Tax) Act 1999 (Cth) as amended.</li>
        <li>Provides sufficient detail to assess progress against job specifications, including identifying the individual personnel performing the services, the fee rate, hours worked, dates, and the specific services performed.</li>
        <li>Is presented in a manner enabling the Principal to determine the goods or services to which the invoice relates and the corresponding price payable. Includes verifying documentation, where necessary or reasonably requested by the Principal.</li>
        <li>Contains the invoice date and the Principal's order number.</li>
      </ul>

      <h4>5.5 Notification of Incorrect Invoices (Pre-Payment)</h4>
      <p>If the Principal determines that an invoice is incorrectly rendered before payment, it will notify the Contractor within seven (7) days of receiving the invoice.</p>

      <h4>5.6 Resolution of Incorrect Invoices (Post-Payment)</h4>
      <p>If an invoice is found to be incorrectly rendered after payment, the Principal may recover any overpayment by deducting the amount from future payments or requiring repayment by the Contractor. This does not limit the Principal's right to pursue other recovery methods.</p>

      <h4>5.7 Disagreement with Payments</h4>
      <p>If the Contractor disagrees with any payment made, they must notify the Principal in writing within seven (7) days of receiving the payment, providing details of the dispute.</p>

      <h4>5.8 Contractor's Responsibility for Taxes and Contributions</h4>
      <p>The Contractor is solely responsible for making appropriate tax deductions, payments, and superannuation contributions in relation to payments or benefits provided by the Principal or to the Contractor's employees, agents, officers, or subcontractors.</p>

      <h4>5.9 Non-Payment for Uncertified Services</h4>
      <p>The Principal will not be obligated to pay the Contract Price for any services that the Principal's representative reasonably determines have not been provided or completed in accordance with this Agreement.</p>

      <h4>5.10 Set-Off of Amounts</h4>
      <p>The Principal may deduct from payments owed to the Contractor any amounts due from the Contractor to the Principal under or in connection with this Agreement.</p>

      <h4>5.11 Contractor's Declaration in Submitting Invoices</h4>
      <p>By submitting an invoice, the Contractor declares the following:</p>
      <ul>
        <li>All remuneration owed to its employees for the services has been paid.</li>
        <li>All workers' compensation insurance premiums for the services have been paid.</li>
        <li>The Contractor is willing and able to provide the Principal with a current Certificate of Currency for workers' compensation insurance upon request.</li>
        <li>All payroll tax obligations relating to its employees for the services have been paid.</li>
        <li>The Contractor indemnifies the Principal on a full indemnity basis against any loss, cost, expense, or damage incurred as a result of any false statements in the invoice.</li>
        <li>For the purposes of this declaration, "the Services" refers to services provided in connection with the invoice.</li>
      </ul>

      <h3>6. Termination</h3>

      <h4>6.1 Termination by Notice</h4>
      <p>The Principal may terminate this Agreement at any time during the Contract Period by providing no less than thirty (30) days' written notice to the Contractor.</p>

      <h4>6.2 Termination for Default</h4>
      <ul>
        <li>Either party may terminate this Agreement prior to the Expiry Date by providing no less than thirty (30) days' written notice if the other party is in default under this Agreement and fails to remedy the default within seven (7) days of receiving written notice of the default.</li>
        <li>The Principal may terminate this Agreement by providing no less than seven (7) days' written notice if the Contractor is unable to perform the Services.</li>
        <li>The Principal may terminate this Agreement at any time, with immediate effect and without prior notice, verbally or in writing, if the Contractor or Contractor's employees engage in any of the following:
          <ul>
            <li>Acts of dishonesty, serious misconduct, or gross negligence in the performance of the Services.</li>
            <li>Engages in any form of sexual activity or indecency with clients.</li>
            <li>Promotes their own business or that of another entity while engaging with the Principal's clients during the course of performing the Services.</li>
            <li>Displays unprofessional or rude behaviour towards clients, hotel staff, or members of the Principal's team.</li>
            <li>Damages the reputation of the Principal or any of its staff.</li>
            <li>Causes injury to any person or damage to third-party property.</li>
            <li>Is late or unable to attend a booking on more than one occasion without notifying the Principal before the booking time.</li>
          </ul>
        </li>
      </ul>

      <h4>6.3 Immediate Termination by Written Notice</h4>
      <p>Either party may terminate this Agreement immediately by providing written notice if the other party:</p>
      <ul>
        <li>Enters into a deed of arrangement, or an order is made for it to be wound up.</li>
        <li>Has a receiver appointed to it.</li>
        <li>Is placed under official management, commits an act of bankruptcy, or is charged with a criminal offence.</li>
        <li>Has a judgment entered against it for more than $20,000.00 that remains unsatisfied or unappealled for more than twenty-one (21) days.</li>
      </ul>

      <h4>6.4 Rights Upon Termination</h4>
      <p>Upon termination of this Agreement for any reason:</p>
      <ul>
        <li>The Contractor must immediately return to the Principal all property belonging to the Principal, including but not limited to equipment, manuals, logos, branded attire, and any other materials containing the Principal's intellectual property.</li>
        <li>The Principal will pay to the Contractor the full amount of the security deposit within five (5) working days of receiving all returned property belonging to the Principal.</li>
        <li>The Principal will reassign the Contractor's bookings to another contractor.</li>
        <li>The Contractor must immediately deposit into the Principal's nominated bank account all payments collected from clients on the Principal's behalf.</li>
        <li>The Principal may deduct from any amounts owed to the Contractor any costs incurred as a result of the Contractor's default, if applicable.</li>
      </ul>
      <p>Termination does not affect the rights of either party that accrued prior to termination. A non-defaulting party retains the right to pursue any other remedies available under law against a defaulting party, subject to Clause 7.</p>

      <h3>7. Dispute Resolution</h3>

      <h4>7.1 Mediation</h4>
      <ul>
        <li>If a dispute arises between the parties in connection with or related to this Agreement (the <strong>Dispute</strong>), either party may provide the other with written notice of their intention to arrange mediation.</li>
        <li>The parties must refer the Dispute to an independent mediator within twenty-one (21) days of the written notice.</li>
        <li>If the parties are unable to agree on a suitable mediator, either party may request the president of the Law Society of Queensland to appoint a mediator.</li>
        <li>The costs of the mediation will be shared equally between the Principal and the Contractor.</li>
      </ul>

      <h4>7.2 Legal Proceedings</h4>
      <p>Neither party may commence court proceedings in relation to the Dispute unless the Dispute remains unresolved twenty-eight (28) days after the date of the written notice provided under Clause 7.1, except in cases involving urgent interlocutory relief.</p>

      <h3>8. Property</h3>

      <h4>8.1 Limited Intellectual Property Licence</h4>
      <p>The Principal grants the Contractor a limited licence to use the Principal's intellectual property for the duration of this Agreement as follows:</p>
      <ul>
        <li>The Contractor may use the Principal's trade mark or other intellectual property strictly in accordance with the requirements outlined in the Rejuvenators Contractor's Information Manual. However, the Contractor is not authorised to apply or include the Principal's trade mark on any product labels, uniforms, or materials without the Principal's prior written consent.</li>
        <li>The Contractor may access, use, or print excerpts from the Rejuvenators Contractor's Information Manual as reasonably necessary to carry out the Services. However, the Contractor is not authorised to use or disclose the contents of the Rejuvenators Contractor's Information Manual for any other purpose without the Principal's prior written consent.</li>
      </ul>

      <h4>8.2 Ownership of Intellectual Property</h4>
      <ul>
        <li>The Contractor acknowledges and agrees that all intellectual property rights in the following belong exclusively to the Principal:
          <ul>
            <li>The Rejuvenators trade mark, product branding, uniform design, and the Rejuvenators Contractor's Information Manual;</li>
            <li>Any material owned by the Principal; and</li>
            <li>Any modifications, adaptations, or updates made by the Contractor to the Principal's materials.</li>
          </ul>
        </li>
        <li>The Contractor further agrees that this Agreement does not grant the Contractor any licence to use the Principal's intellectual property except as strictly necessary to carry out the Services.</li>
        <li>The Contractor waives any moral rights (if applicable) attached to any material the Contractor creates, modifies, or adapts for the Principal under this Agreement.</li>
      </ul>

      <h3>9. Indemnity and Limitation of Liability</h3>

      <h4>9.1 Losses</h4>
      <p>Each party agrees to indemnify, defend, and hold harmless the other party, along with its employees, officers, agents, contractors, and directors, against any and all losses, costs, expenses, and damages, including reasonable legal fees, arising from:</p>
      <ul>
        <li>Negligence or malpractice;</li>
        <li>Reckless or intentional misconduct; or</li>
        <li>Failure to perform its obligations and responsibilities under this Agreement.</li>
      </ul>

      <h4>9.2 Personal Injury or Death</h4>
      <p>The Contractor agrees to indemnify and keep indemnified the Principal against any claim, demand, action, suit, or proceeding brought by any person against the Principal, its employees, or agents in respect of:</p>
      <ul>
        <li>Personal injury or death of any person;</li>
        <li>Loss of or damage to property; or</li>
        <li>Any other loss or damage whatsoever,</li>
      </ul>
      <p>arising out of or as a consequence of any unlawful act, negligent act, or omission by the Contractor, its employees, or agents in the execution of the Services under this Agreement.</p>
      <p>This indemnity shall also cover any costs and expenses incurred by the Principal in relation to such claims, demands, actions, suits, or proceedings. However, the indemnity shall apply only to the extent that such loss or damage results from the Contractor's negligence. If any loss or damage is partly caused by the negligent act or omission of another party, the indemnity shall not extend to the portion of the loss or damage attributable to that other party.</p>

      <h4>9.3 Consequential Damage</h4>
      <p>The Contractor indemnifies the Principal at all times against any liability for indirect or consequential damages which result from the provision of Services by the Contractor, its servants or agents, including but not limited to loss of profits and legal costs on a full solicitor-and-own-client basis.</p>

      <h3>10. Restraint and Non-Solicitation</h3>

      <h4>10.1 Contractor's Acknowledgements</h4>
      <p>The Contractor acknowledges and agrees that</p>
      <ul>
        <li>In providing the Services, the Contractor will:
          <ul>
            <li>Have access to and knowledge of the Principal's products, services, skills, and techniques;</li>
            <li>Become acquainted with the Principal's clients and suppliers, including their special needs and requirements;</li>
            <li>Become aware of the identity of prospective clients whom the Principal is attempting to attract; and</li>
            <li>Be privy to Confidential Information and Intellectual Property relating to the Principal, its clients, suppliers, and business methods.</li>
          </ul>
        </li>
        <li>The restraints imposed on the Contractor in this Agreement are the only effective, fair, and reasonable means of protecting the Principal's legitimate business interests.</li>
        <li>The duration, scope, and application of the restraints contained in this Agreement are no greater than reasonably necessary to protect the Principal's legitimate business interests, including its relationships with clients, suppliers, employees, agents, and other stakeholders; the goodwill of its business; and its Confidential Information and Intellectual Property.</li>
        <li>The Contractor's Contract Price constitutes adequate consideration for the restraint obligations imposed under this Agreement.</li>
      </ul>

      <h4>10.2 Restraint Obligations</h4>
      <p>The Contractor agrees that, in light of the circumstances outlined in clause 10.1, they will not, without the Principal's prior written consent, directly or indirectly, for their own benefit or the benefit of another party, and in any capacity (including as a principal, employee, agent, director, officer, partner, consultant, contractor, or advisor), engage in any of the activities specified in clause 10.3 within the geographical areas specified in clause 10.4, and for the periods outlined in clause 10.5, after the Termination Date.</p>

      <h4>10.3 Restricted Activities</h4>
      <p>The Contractor must not:</p>
      <ul>
        <li>Canvass, solicit, or entice away (or attempt to do so) the business or custom of any client, or provide products or services to any client, with whom the Contractor or their team had dealings on behalf of the Principal in the 12 months prior to the Termination Date.</li>
        <li>Induce or encourage (or attempt to do so) any client, with whom the Contractor or their team had dealings on behalf of the Principal in the 12 months prior to the Termination Date, to terminate, not renew, or alter any business relationship, contract, or arrangement with the Principal, or disclose any Confidential Information.</li>
        <li>Induce or encourage (or attempt to do so) any supplier, with whom the Contractor had dealings on behalf of the Principal in the 12 months prior to the Termination Date, to terminate, not renew, or alter any business relationship, contract, or arrangement with the Principal, or disclose any Confidential Information.</li>
        <li>Induce or encourage (or attempt to do so) any employee, agent, director, officer, partner, contractor, advisor, or consultant of the Principal, with whom the Contractor had dealings in the 12 months prior to the Termination Date, to terminate, not renew, or alter any business relationship, contract, or arrangement with the Principal, or disclose any Confidential Information.</li>
      </ul>

      <h4>10.4 Geographical Areas</h4>
      <p>The geographical areas to which the restraints apply are, in descending order:</p>
      <ul>
        <li>Australia;</li>
        <li>The State of Queensland;</li>
        <li>Brisbane;</li>
        <li>Fortitude Valley.</li>
      </ul>

      <h4>10.5 Restraint Periods</h4>
      <p>The restraint periods, commencing immediately after the Termination Date, are:</p>
      <ul>
        <li>Twelve (12) months;</li>
        <li>Nine (9) months, if the 12-month period is deemed unenforceable;</li>
        <li>Six (6) months, if the 9-month period is deemed unenforceable;</li>
        <li>Three (3) months, if the 6-month period is deemed unenforceable.</li>
      </ul>

      <h4>10.6 Disclosure of Restraint</h4>
      <p>For the duration of the restraint period, the Contractor must disclose the existence of these restraints to any person or entity with whom they engage in work that may conflict with the obligations imposed under this clause.</p>

      <h4>10.7 Separate Covenants</h4>
      <p>Each combination of restricted activities (clause 10.3), geographical areas (clause 10.4), and restraint periods (clause 10.5) constitutes a separate covenant. If one or more of these covenants is found to be unenforceable, the validity of the remaining covenants will not be affected.</p>

      <h4>10.8 Enforceability of Restraints</h4>
      <p>If any part of a restraint is determined by a court to be void, invalid, or otherwise unenforceable, the remaining provisions of this clause will remain enforceable.</p>

      <h4>10.9 Modifications to Enforceability</h4>
      <p>If a restraint would be valid and enforceable with modifications (such as reducing the scope of activities, geographical area, or period), the restraint will apply with those modifications to ensure its validity and enforceability.</p>

      <h3>11. General</h3>

      <h4>11.1 Jurisdiction</h4>
      <p>The laws of Queensland apply to this Agreement and the parties submit to the courts of that jurisdiction.</p>

      <h4>11.2 Goods and Services Tax (GST)</h4>
      <p>All fees, rates, charges and expenses in this Agreement are exclusive of GST unless stated to be inclusive of GST.</p>

      <h4>11.3 Whole Agreement</h4>
      <ul>
        <li>This Agreement supersedes all prior representations, arrangements, understandings, and agreements between the parties and represents the entire complete and exclusive understanding and agreement between the parties relating to the subject matter of the Agreement between the Principal and Contractor.</li>
        <li>Principal and Contractor each acknowledge and agree that they have not relied on any written or oral representation, arrangement, understanding or agreement not expressly set out or referred to in this Agreement.</li>
      </ul>

      <h4>11.4 Severance</h4>
      <p>If any provision of this Agreement is determined to be illegal, invalid, void, or voidable, the legality or validity of the remainder of the Agreement will not be affected and will continue in effect.</p>

      <h4>11.5 Waiver</h4>
      <p>Any delay or failure to enforce any rights in relation to a breach by the other party will not be construed as a waiver of those rights.</p>

      <h4>11.6 Varying the Agreement</h4>
      <p>Any variation or amendment to this Agreement must be in writing and signed by all parties, except where otherwise specifically allowed under this Agreement.</p>

      <h4>11.7 Surviving Obligations</h4>
      <p>The Parties agree that their obligations under Clauses 4.7 and 7 to 10 (inclusive) shall survive the termination of this Agreement, regardless of the reason for termination.</p>

      <h4>11.8 Single and Plural</h4>
      <p>In this Agreement, words in the singular include the plural, and words in the plural include the singular, as the context requires.</p>

      <h4>11.9 Communication and Notices</h4>
      <p><strong>Permitted Methods</strong></p>
      <p>Any written communication, notice, or document required or permitted under this Agreement must be delivered using one of the following methods:</p>
      <ul>
        <li>By email to the email address specified by the receiving party in writing;</li>
        <li>By registered post to the physical address specified by the receiving party in writing; or</li>
        <li>By personal delivery to the receiving party's physical address.</li>
      </ul>
      <p><strong>Deemed Delivery</strong></p>
      <p>A written communication, notice, or document is deemed to have been delivered:</p>
      <ul>
        <li>If sent by email, at the time it is sent, provided no bounce-back or delivery failure notification is received;</li>
        <li>If sent by registered post, three (3) business days after the date of posting within the same country, or seven (7) business days if posted internationally;</li>
        <li>If delivered in person, upon receipt by the recipient or their representative.</li>
      </ul>
      <p><strong>Updating Contact Information</strong></p>
      <p>Each party must promptly notify the other in writing of any changes to their email or physical address for the purposes of this clause.</p>

      <h4>11.10 Acknowledgement</h4>
      <p>By signing this Agreement, the Contractor acknowledge that they have read and accepted the entire Agreement, including its terms and Appendix. The Contractor further acknowledge that they have either sought independent legal advice regarding this Agreement or have chosen to waive their right to obtain such advice.</p>
    </div>
  </div>$$,

  -- PDF URL - will be same as before
  'https://dzclnjkjlmsivikojygv.supabase.co/storage/v1/object/public/therapist-documents/legal/Independent-Contractor-Agreement-V4.pdf',

  -- Summary points remain the same
  $$
{
  "key_terms": [
    "Contract Period: 12 months (auto-renews)",
    "Relationship: Independent Contractor (NOT employment)",
    "Payment: 55% of Job RRP (see website for current rates)",
    "Notice Period: 30 days for termination"
  ],
  "obligations": [
    "Complete StressBuster Massage training",
    "Maintain Therapist App on your device",
    "Maintain $10M+ public liability insurance",
    "Handle own tax, super, and GST",
    "Keep client information confidential",
    "Provide own equipment & supplies",
    "Submit weekly invoices"
  ],
  "cancellation_policy": [
    "Your late cancel (<1hr): Full charge + review",
    "Client cancel <3hrs: You get FULL payment",
    "Client cancel >3hrs: No payment to you"
  ],
  "non_compete": [
    "Duration: 3-12 months after termination",
    "Cannot solicit clients you served",
    "Geographic restrictions apply",
    "Must disclose restraints to new employers"
  ],
  "insurance_required": [
    "Workers Compensation",
    "Vehicle & Equipment Insurance",
    "Public & Products Liability ($10M+)"
  ],
  "immediate_termination_reasons": [
    "Dishonesty or serious misconduct",
    "Sexual activity/indecency with clients",
    "Promoting own business to clients",
    "Unprofessional behavior",
    "Repeated late/no-shows"
  ]
}
$$::jsonb,

  true, -- is_active
  NOW() -- effective_from
);

-- Deactivate old versions
UPDATE public.agreement_templates
SET is_active = false
WHERE version IN ('v1.0', 'v2.0', 'v3.0');

-- Verify
SELECT version, title, is_active, length(content_html) as html_length
FROM public.agreement_templates
WHERE version = 'v4.0';

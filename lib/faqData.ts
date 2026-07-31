/**
 * FAQ content shared by the /faqs page and its FAQPage structured data.
 * Extracted from the page component so the server can emit JSON-LD without
 * importing a client module. Keep this in sync when editing the FAQ page.
 */
export type FaqEntry = { category: string; question: string; answer: string }

export const FAQ_ENTRIES: FaqEntry[] = [
  {
    "category": "Orders & Shipping",
    "question": "How long does shipping take?",
    "answer": "Standard shipping typically takes 5-7 business days within the continental United States. Expedited shipping (2-3 business days) is available at checkout. Orders are processed within 1-2 business days, though this may extend to 3-5 days during peak seasons."
  },
  {
    "category": "Orders & Shipping",
    "question": "How is shipping calculated, and do you offer free shipping?",
    "answer": "Shipping is based on the total weight of your order and the distance from us (Maryland) to your address, so you only pay what it actually costs to ship. Your exact shipping fee and order weight are shown at checkout before you pay. Orders of $150 or more ship free within the United States. Applicable sales tax is calculated at checkout."
  },
  {
    "category": "Orders & Shipping",
    "question": "Can I track my order?",
    "answer": "Absolutely! Once your order ships, you will receive a tracking number via email. You can use this number to track your package on the carrier's website."
  },
  {
    "category": "Orders & Shipping",
    "question": "Do you ship internationally?",
    "answer": "We ship to select international destinations. Shipping times and costs vary by location. Please note that customers are responsible for any customs fees or import duties."
  },
  {
    "category": "Products & Inventory",
    "question": "How do I know if a book is age-appropriate?",
    "answer": "Each product listing includes an age recommendation. We carefully curate our collection to ensure content is appropriate for the suggested age ranges. If you need personalized recommendations, feel free to contact us!"
  },
  {
    "category": "Products & Inventory",
    "question": "Can I request a specific book that's not in stock?",
    "answer": "Yes! We're happy to help you find specific titles. Contact us with the book details, and we'll do our best to source it for you or suggest similar alternatives."
  },
  {
    "category": "Products & Inventory",
    "question": "Are your books available in different languages?",
    "answer": "We carry books in English and Arabic, as well as bilingual editions. Our collection includes Islamic literature, Arabic learning resources, and character-building stories in multiple languages."
  },
  {
    "category": "Products & Inventory",
    "question": "Do you offer bulk discounts for schools or masajid?",
    "answer": "Yes! We offer special pricing for schools, masajid, and community organizations placing bulk orders. Please contact us directly to discuss your needs and receive a custom quote."
  },
  {
    "category": "Returns & Exchanges",
    "question": "What is your return policy?",
    "answer": "Items may be returned within 14 days of purchase in their original condition. Books must be unmarked and unread. Refunds are processed within 5-7 business days of receiving the returned items."
  },
  {
    "category": "Returns & Exchanges",
    "question": "How do I initiate a return?",
    "answer": "Contact us via email or phone with your order number and reason for return. We'll provide you with a return authorization and shipping instructions."
  },
  {
    "category": "Returns & Exchanges",
    "question": "Can I exchange an item instead of returning it?",
    "answer": "Yes! If you'd like to exchange an item for a different product, let us know when you initiate the return. We'll help facilitate the exchange process."
  },
  {
    "category": "Returns & Exchanges",
    "question": "What if I receive a damaged item?",
    "answer": "We apologize if that happens! Please contact us immediately with photos of the damage. We'll arrange a replacement or full refund, including shipping costs, at no charge to you."
  },
  {
    "category": "Events & Book Fairs",
    "question": "How do I book Eduvate Kids for a school event?",
    "answer": "Contact us at least 4-6 weeks before your event date. We'll discuss your needs, student demographics, budget, and event logistics to create a customized book fair experience."
  },
  {
    "category": "Events & Book Fairs",
    "question": "What types of events do you support?",
    "answer": "We support school book fairs, masjid fundraisers, community literacy events, Ramadan bazaars, and educational conferences. Each event is tailored to your audience and goals."
  },
  {
    "category": "Events & Book Fairs",
    "question": "Is there a minimum order for events?",
    "answer": "Event requirements vary based on the type and size of your gathering. Contact us to discuss your specific needs, and we'll work with you to create a suitable arrangement."
  },
  {
    "category": "Events & Book Fairs",
    "question": "Can families order online after the event?",
    "answer": "Yes! We often extend event pricing for a limited time after the fair, allowing families to order online. We'll provide details during your event planning."
  },
  {
    "category": "Account & Payment",
    "question": "Do I need an account to place an order?",
    "answer": "No account is needed. You can check out as a guest by entering your shipping and payment details at checkout. You will receive an order confirmation by email."
  },
  {
    "category": "Account & Payment",
    "question": "What payment methods do you accept?",
    "answer": "We accept all major credit and debit cards (Visa, Mastercard, American Express, Discover) via secure Stripe checkout. Orders are shipped to the address provided once payment is confirmed. Additional payment options are being added."
  },
  {
    "category": "Account & Payment",
    "question": "Is my payment information secure?",
    "answer": "Absolutely. We use industry-standard SSL encryption to protect your payment information. We do not store your full credit card details on our servers."
  },
  {
    "category": "Account & Payment",
    "question": "Can I modify my order after placing it?",
    "answer": "Orders can be modified within 24 hours of placement if they haven't been shipped yet. Contact us as soon as possible, and we'll do our best to accommodate your request."
  }
]

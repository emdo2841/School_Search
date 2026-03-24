export const validatePhoneNumber = async (phone: string): Promise<boolean> => {
  try {
    let formattedPhone = phone.trim();

    // 1. Convert local Nigerian numbers (e.g., 07043717717 -> +2347043717717)
    if (formattedPhone.startsWith("0") && formattedPhone.length === 11) {
      formattedPhone = "+234" + formattedPhone.substring(1);
    } 
    // 2. Handle '00' international prefix (e.g., 0044... -> +44...)
    else if (formattedPhone.startsWith("00")) {
      formattedPhone = "+" + formattedPhone.substring(2);
    } 
    // 3. Ensure it starts with a '+' if it's already an international number without it
    else if (!formattedPhone.startsWith("+")) {
      formattedPhone = "+" + formattedPhone;
    }

    // Call the Antideo API
    const response = await fetch(`https://api.antideo.com/phone/${encodeURIComponent(formattedPhone)}`);
    
    if (!response.ok) {
        console.error("Antideo API returned an error:", response.status);
        // Fallback: If the API is down, just check if it looks generally valid
        return formattedPhone.length >= 10 && formattedPhone.length <= 15;
    }

    const data = await response.json();
    return data.valid === true;

  } catch (error) {
    console.error("Phone validation error:", error);
    
    // FALLBACK: If Antideo times out entirely, don't block the user!
    // Just do a basic check to ensure it's a reasonable length and mostly numbers.
    const cleanPhone = phone.replace(/\D/g, ""); // Strip out any non-numbers
    if (cleanPhone.length >= 10 && cleanPhone.length <= 15) {
        console.log("Using fallback validation: Phone looks okay.");
        return true;
    }
    
    return false; 
  }
};
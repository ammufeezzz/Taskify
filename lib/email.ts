import NodeMailer from "nodemailer"
const transporter = NodeMailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,   // your gmail
    pass: process.env.EMAIL_PASS,   // your app password
  },
});

const emailTemplate = (teamName: string, inviterName: string, role: string, inviteUrl: string) => `
<!DOCTYPE html>
<html>
  <body style="font-family: sans-serif;">
    <h2>You’ve been invited to join ${teamName}</h2>
    <p>${inviterName} invited you to join <strong>${teamName}</strong> as a <strong>${role}</strong>.</p>

    <a href="${inviteUrl}" 
       style="display:inline-block; padding:10px 20px; background:#0066cc; color:white; text-decoration:none; border-radius:6px;">
       Accept Invitation
    </a>

    <p style="margin-top:20px;">Or copy this link:</p>
    <p>${inviteUrl}</p>
  </body>
</html>
`;

export async function sendInvitationEmail(params: {
  email: string;
  teamName: string;
  inviterName: string;
  role: string;
  inviteUrl: string;
}) {
  const { email, teamName, inviterName, role, inviteUrl } = params;

  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log("📧 EMAIL DISABLED - Gmail SMTP not configured");
      console.log("Invite URL:", inviteUrl);
      return { success: true, skipped: true };
    }

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `You've been invited to join ${teamName}`,
      html: emailTemplate(teamName, inviterName, role, inviteUrl),
    });

    console.log("✅ Email sent via Gmail SMTP:", info.messageId);
    return { success: true };
  } catch (error) {
    console.error("❌ Error sending email:", error);
    return { success: false, error };
  }
}
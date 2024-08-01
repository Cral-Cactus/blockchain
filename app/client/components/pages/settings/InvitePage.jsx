import React from "react";
import { Card } from "antd";

import InviteForm from "../../adminUser/InviteForm.jsx";

export default class InvitePage extends React.Component {
  render() {
    return (
      <Card
        title="Invite New Admins"
        bodyStyle={{ maxWidth: "400px" }}
        bordered={false}
        extra={
          <a
            href="https://admin.stengo.co/help/invite-admins" // page shows as working only to logged in admins
            target="_blank"
          >
            Help
          </a>
        }
      >
        <p>
          Enter the email addresses of the administrators you'd like to invite,
          and choose the role they should have.
        </p>
        <InviteForm />
      </Card>
    );
  }
}
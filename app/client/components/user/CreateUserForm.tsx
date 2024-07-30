import React, { useEffect } from "react";
import { connect } from "react-redux";
import { Form, Input, Button, Select } from "antd";

import QrReadingModal from "../qrReadingModal";
import { TransferUsage } from "../../reducers/transferUsage/types";
import { TransferAccountTypes } from "../transferAccount/types";
import { Token } from "../../reducers/token/types";
import { getActiveToken } from "../../utils";
import { ReduxState } from "../../reducers/rootReducer";
import FormValidation from "../form/FormValidation";
import { AdaptedPhoneInput } from "../form/PhoneAntDesign";
import { GenderTypes } from "./types";

const { Option } = Select;

export interface ICreateUser {
  firstName?: string;
  lastName?: string;
  publicSerialNumber?: string;
  phone?: string;
  initialDisbursement?: number;
  bio?: string;
  gender?: string;
  referredBy?: string;
  location?: string;
  businessUsage?: string;
  usageOtherSpecific?: string;
  accountTypes: string[];
}

export interface ICreateVendor {
  firstName?: string;
  lastName?: string;
  publicSerialNumber?: string;
  phone?: string;
  isCashierAccount?: boolean;
  existingVendorPhone?: string;
  existingVendorPin?: string;
  location?: string;
  transferAccountName?: string;
}

export type ICreateUserUpdate = ICreateUser & ICreateVendor;

interface OuterProps {
  onSubmit: (values: ICreateUserUpdate) => void;
  users: any;
  transferUsages: TransferUsage[];
}

interface StateProps {
  activeToken: Token;
  defaultDisbursement: any;
  validRoles: TransferAccountTypes[];
}

type Props = OuterProps & StateProps;

const CreateUserForm = (props: Props) => {
  const [form] = Form.useForm();
  useEffect(() => {
    const { defaultDisbursement, validRoles } = props;
    form.setFieldsValue({
      accountTypes: [validRoles[0]],
      gender: "female",
      initialDisbursement: defaultDisbursement
    });
  }, []);

  const setSerialNumber = (data: string) => {
    const cleanedData = data.replace(/^\s+|\s+$/g, "");
    form.setFieldsValue({ publicSerialNumber: cleanedData });
  };

  const optionizeUsages = () => {
    return props.transferUsages
      .map(transferUsage => {
        return {
          name: transferUsage.name,
          value: transferUsage.name
        };
      })
      .concat({
        name: "Other",
        value: "other"
      });
  };
  const onFinish = (values: ICreateUserUpdate) => {
    props.onSubmit(values);
  };

  const {
    activeToken,
    transferUsages,
    defaultDisbursement,
    validRoles
  } = props;
  let initialDisbursementAmount: JSX.Element;

  if (defaultDisbursement > 0) {
    initialDisbursementAmount = (
      <Form.Item label="Initial Disbursement Amount" name="initialDisbursement">
        <Input
          addonAfter={
            activeToken !== null && typeof activeToken !== "undefined"
              ? activeToken.symbol
              : null
          }
        />
      </Form.Item>
    );
  }

  return (
    <div>
      <Form onFinish={onFinish} layout="vertical" form={form}>
        <Form.Item label="Account Types" name="accountTypes">
          <Select mode="multiple">
            {Object.values(validRoles).map((value, index) => {
              return (
                <Option value={value} key={index}>
                  {value}
                </Option>
              );
            })}
          </Select>
        </Form.Item>
        <Form.Item
          label="ID Number"
          name="publicSerialNumber"
          dependencies={["phone"]}
          rules={[
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value && !getFieldValue("phone")) {
                  return Promise.reject(
                    "Must provide either phone number or ID number"
                  );
                }
                return Promise.resolve();
              }
            })
          ]}
        ></Form.Item>